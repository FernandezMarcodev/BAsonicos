// Genera un par de claves VAPID para notificaciones push. Copiá la salida a tu
// backend/.env (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY).
package main

import (
	"fmt"

	"github.com/SherClockHolmes/webpush-go"
)

func main() {
	privada, publica, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		panic("no se pudieron generar las claves VAPID: " + err.Error())
	}
	fmt.Println("VAPID_PRIVATE_KEY=" + privada)
	fmt.Println("VAPID_PUBLIC_KEY=" + publica)
	fmt.Println("# VAPID_SUBJECT=mailto:soporte@bassonicos.com")
}