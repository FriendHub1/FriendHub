# Cloudflare: despliegue aislado de Stay Safe, Sweetheart! BETA

**Este flujo no publica por defecto.** Solo la rama
feature/xoxo-safety-reminder-beta puede publicar el Worker
xoxo-safety-beta. El Worker de producción friendhub no se modifica.

## Controles

- Wrangler separado: wrangler.safety-beta.jsonc; sin routes/domains personalizados.
- Empaquetado con lista blanca de recursos públicos y los ocho scripts BETA.
- No se suben archivos SQL, pruebas, secretos, workflows ni documentos.
- Los correos de actividad están desactivados en este Worker.
- La variable XOXO_SAFETY_BETA_DEPLOY_ENABLED debe valer true.
- La función RPC de Supabase verifica la autorización temporal en servidor:
  los parámetros de la URL de vista previa no conceden permisos.
- No mezclar este Worker con main ni fusionar cambios para ejecutarlo.

## Configurar GitHub (el usuario conserva los secretos)

En FriendHub1/FriendHub → Settings → Secrets and variables → Actions,
agregar estos secretos (en repositorio o entorno xoxo-safety-beta):

- XOXO_SAFETY_BETA_CF_API_TOKEN: token mínimo de Cloudflare Workers.
- XOXO_SAFETY_BETA_CF_ACCOUNT_ID: identificador de la cuenta Cloudflare.

Crear la VARIABLE de repositorio XOXO_SAFETY_BETA_DEPLOY_ENABLED
con el valor true solo cuando quieras publicar el sitio de pruebas.
Opcionalmente configurar protección/revisores en el entorno
xoxo-safety-beta.

El workflow valida el paquete al hacer push a la rama BETA. Con la
variable true y ambos secretos presentes, publica usando EXCLUSIVAMENTE
wrangler.safety-beta.jsonc. Si no están, no publica.

GitHub puede requerir que los workflows existan en la rama principal
para usar workflow_dispatch. Este flujo tiene disparador push limitado
a la rama BETA, por lo que no es necesario modificar main: después de
configurar la variable y secretos, se necesita un nuevo commit de BETA
que afecte alguno de los paths del workflow.

## Validación de usuario

La URL de Workers aparece en el log de una publicación exitosa. No
supongas ni inventes el subdominio de la cuenta.

Abrir en esa URL (solo después del despliegue) con parámetros:

?xoxo_safety_chat_beta=1&xoxo_safety_admin_beta=1&xoxo_safety_report_write_beta=1

Hacer pruebas con la cuenta autorizada por siete días y un mensaje
enviado solo entre cuentas de prueba; comprobar el reporte real
en el visor ya existente de @XOXOAdmin después de verificar el PIN.

La activación pública en xoxoavenue.com, la conservación de evidencias,
las pruebas en iPhone físico y la aprobación de lanzamiento son tareas
distintas. Nunca dar por desplegado algo sin una ejecución exitosa.
