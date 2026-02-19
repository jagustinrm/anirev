# Migraciones de Supabase

Copié las migraciones desde `backend/supabase-migrations.sql` aquí para mantenerlas junto al proyecto Next.js.

Cómo ejecutar

1) Recomendada: usar el SQL Editor de Supabase
   - Entra a tu proyecto en https://app.supabase.com
   - Abre "SQL Editor" -> "New query"
   - Copia el contenido de `migrations/supabase-migrations.sql` y pégalo en el editor.
   - Ejecuta la consulta.

2) Usar psql (si tienes la connection string de Postgres):
   - Obtén la connection string desde Project -> Settings -> Database -> Connection string (Admin).
   - Guarda la URI en la variable de entorno `SUPABASE_DB_URL` localmente.
   - Desde la carpeta `next-app` corre:

     psql "$env:SUPABASE_DB_URL" -f migrations/supabase-migrations.sql

Notas
- La `service_role` key permite saltar RLS y debe usarse solo en entornos server-side controlados.
- Si querés, puedo ejecutar las migraciones por vos si me das la `SUPABASE_DB_URL` (o hacerlo en tu máquina siguiendo las instrucciones).