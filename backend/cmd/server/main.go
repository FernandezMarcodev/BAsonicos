package main

import (
	"context"
	"fmt"
	"log"

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

	// Limpieza inicial al arrancar (pasados + duplicados), igual que el backend Flask.
	if res, err := services.EjecutarScraper(context.Background(), cfg, "mantenimiento"); err != nil {
		fmt.Printf("AVISO: limpieza inicial falló: %v\n", err)
	} else {
		fmt.Printf("Limpieza inicial completada (exitoso=%v).\n", res.Exitoso)
	}

	// Procesos de fondo (reemplazan los threads de Flask).
	go services.RunSchedulers(context.Background(), cfg, pool)

	r := gin.Default()
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(middleware.CORS(), middleware.NoStore())

	api := handlers.New(pool, cfg)

	r.GET("/", api.Health)
	r.GET("/conciertos", api.GetConciertos)
	r.GET("/conciertos.ics", api.CalendarioConciertos)
	r.GET("/clave_vapid", api.ClaveVapid)
	r.GET("/scrape_conciertos_agendade", api.ScrapeConciertos)
	r.POST("/registro", api.Registro)
	r.POST("/login", api.Login)

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

	addr := cfg.Host + ":" + cfg.Port
	fmt.Printf("API escuchando en http://%s\n", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("El servidor no pudo arrancar: %v", err)
	}
}