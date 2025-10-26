// /api/pixelpay/return.js
// Es llamado por el navegador después de la autenticación 3DS.
export default async function handler(req, res) {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pago Procesado</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: sans-serif; text-align: center; padding: 50px; }
            </style>
            <script>
                // Esta función intenta cerrar el Web View en entornos nativos
                function closeWebView() {
                    // Intento 1: General (puede funcionar en muchos Web Views)
                    window.close();
                    
                    // Intento 2: Fallback para asegurar que el flujo de FlutterFlow se reanude
                    setTimeout(function() {
                        document.body.innerHTML = '<h1>¡Listo! Regresando a la app...</h1>';
                    }, 500);
                }
                
                window.onload = closeWebView;
            </script>
        </head>
        <body>
            <h1>Pago en Proceso...</h1>
            <p>La autenticación ha finalizado. Regresando a la aplicación Todo Aqui HN.</p>
        </body>
        </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlContent);
}