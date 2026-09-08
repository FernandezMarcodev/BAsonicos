package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bassonicos/internal/config"
	"bassonicos/internal/db"
	"bassonicos/internal/handlers"
	"bassonicos/internal/middleware"
	"bassonicos/internal/services"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Error de configuración: %v", err)
	}

	pool, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("No se pudo inicializar la base de datos: %v", err)
	}
	defer pool.Close()
	fmt.Println("Base de datos lista (PostGIS + tablas verificadas).")

	// Contexto para los procesos de fondo, cancelado al apagar el servidor.
	ctxFondo, cancelFondo := context.WithCancel(context.Background())
	defer cancelFondo()

	// Limpieza inicial al arrancar (pasados + duplicados), igual que el backend Flask.
	if res, err := services.EjecutarScraper(context.Background(), cfg, "mantenimiento"); err != nil {
		fmt.Printf("AVISO: limpieza inicial falló: %v\n", err)
	} else {
		fmt.Printf("Limpieza inicial completada (exitoso=%v).\n", res.Exitoso)
	}

	// Procesos de fondo (reemplazan los threads de Flask).
	go services.RunSchedulers(ctxFondo, cfg, pool)

	r := gin.Default()
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(middleware.CORS(cfg.CORSOrigins), middleware.NoStore())

	api := handlers.New(pool, cfg)

	r.GET("/", api.Health)
	r.GET("/health", api.HealthJSON)
	r.HEAD("/health", api.HealthJSON)
	r.GET("/conciertos", api.GetConciertos)
	r.GET("/conciertos.ics", api.CalendarioConciertos)
	r.GET("/clave_vapid", api.ClaveVapid)

	r.POST("/registro", middleware.RateLimit(10, time.Minute), api.Registro)
	r.POST("/login", middleware.RateLimit(10, time.Minute), api.Login)

	privado := r.Group("")
	privado.Use(middleware.Auth(cfg.JWTSecret))
	privado.GET("/me", api.Me)
	privado.GET("/favoritos", api.GetFavoritos)
	privado.GET("/favoritos.ics", api.CalendarioFavoritos)
	privado.POST("/favoritos/:conciertoId", api.PostFavorito)
	privado.DELETE("/favoritos/:conciertoId", api.DeleteFavorito)
	privado.GET("/seguidos", api.GetSeguidos)
	privado.POST("/seguidos", api.PostSeguido)
	privado.DELETE("/seguidos/:artista", api.DeleteSeguido)
	privado.GET("/novedades", api.GetNovedades)
	privado.POST("/novedades/:id/leida", api.MarcarNovedadLeida)
	privado.POST("/novedades/leer_todas", api.MarcarTodasNovedadesLeidas)
	privado.POST("/suscripcion_push", api.PostSuscripcionPush)
	privado.DELETE("/suscripcion_push", api.DeleteSuscripcionPush)

	server := &http.Server{
		Addr:         cfg.Host + ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 20 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Arranca el servidor en una goroutine para poder esperar la señal de cierre.
	go func() {
		fmt.Printf("API escuchando en http://%s\n", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("El servidor no pudo arrancar: %v", err)
		}
	}()

	// Espera SIGINT (Ctrl+C) o SIGTERM (cierre de container/paas) para apagar limpio.
	señal := make(chan os.Signal, 1)
	signal.Notify(señal, os.Interrupt, syscall.SIGTERM)
	<-señal
	fmt.Println("Señal de cierre recibida, apagando...")

	cancelFondo() // detiene los schedulers para que no usen el pool al cerrarse.

	ctxCierre, cancelCierre := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelCierre()
	if err := server.Shutdown(ctxCierre); err != nil {
		log.Printf("Apagado del servidor con errores: %v", err)
	}
	fmt.Println("Servidor apagado correctamente.")
}