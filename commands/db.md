# Database & Migrations — Agenda Médica

Eres un experto en bases de datos PostgreSQL y Flyway para este sistema médico.

## Stack de base de datos
- **PostgreSQL** (default: localhost:5432/agenda_medica)
- **Flyway** para versionado de migraciones (`src/main/resources/db/migration/`)
- **Spring Data JPA + Hibernate** como ORM
- **DDL**: `spring.jpa.hibernate.ddl-auto=update` (dev) → debe ser `validate` en producción

## Esquema actual (resumen)

```sql
-- Tablas principales
usuario (id, username UNIQUE, password, activo)
paciente (id, documento UNIQUE, nombre, apellido, telefono, obra_social)
profesional (id, nombre, apellido, especialidad, matricula, telefono, activo)
disponibilidad_semanal_profesional (id, profesional_id FK, dia_semana, hora_inicio, hora_fin, duracion_minutos, activo)
agenda_dia_profesional (id, profesional_id FK, fecha, hora_inicio, hora_fin, duracion_turno, tipo, UNIQUE(profesional_id, fecha))
turno (id, agenda_dia_profesional_id FK, paciente_id FK, hora UNIQUE con agenda, estado, notas, medio_pago, valor, INDEX en agenda_id e paciente_id)
```

## Convenciones de migraciones Flyway

### Nomenclatura
```
V{número}__{descripcion_snake_case}.sql
Ejemplos:
V5__add_columna_email_paciente.sql
V6__create_table_notificaciones.sql
V7__add_index_turno_fecha.sql
```

### Reglas de oro
1. **NUNCA modificar** migraciones existentes (V1-V4 ya aplicadas)
2. Siempre **idempotente** cuando sea posible (IF NOT EXISTS, IF EXISTS)
3. Incluir comentarios SQL explicando el propósito
4. Una migración por cambio lógico independiente
5. Testear en dev antes de confirmar que la migración es correcta

### Template de migración nueva
```sql
-- V{N}__{descripcion}.sql
-- Propósito: [explicar qué hace y por qué]

-- Agregar columna con valor default para filas existentes
ALTER TABLE nombre_tabla 
ADD COLUMN IF NOT EXISTS nueva_columna VARCHAR(100) DEFAULT 'valor' NOT NULL;

-- Crear índice para mejorar performance de consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tabla_columna ON nombre_tabla(columna);

-- Crear nueva tabla
CREATE TABLE IF NOT EXISTS nueva_tabla (
    id BIGSERIAL PRIMARY KEY,
    campo_obligatorio VARCHAR(100) NOT NULL,
    campo_opcional TEXT,
    referencia_id BIGINT REFERENCES otra_tabla(id),
    created_at TIMESTAMP DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE NOT NULL
);
```

## Queries de diagnóstico útiles (PostgreSQL)

```sql
-- Ver todas las tablas y sus filas
SELECT schemaname, tablename, n_live_tup 
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- Ver índices existentes
SELECT tablename, indexname, indexdef 
FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;

-- Ver foreign keys
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc 
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';

-- Turnos por estado (análisis de datos)
SELECT estado, COUNT(*) FROM turno GROUP BY estado;

-- Agenda del día actual
SELECT p.nombre, p.apellido, a.fecha, a.hora_inicio, a.hora_fin, a.tipo
FROM agenda_dia_profesional a JOIN profesional p ON a.profesional_id = p.id
WHERE a.fecha = CURRENT_DATE ORDER BY p.apellido, a.hora_inicio;

-- Turnos sin paciente asignado (slots libres)
SELECT COUNT(*) FROM turno WHERE paciente_id IS NULL AND estado = 'RESERVADO';
```

## Optimizaciones de performance a considerar

### Índices recomendados
```sql
-- Búsqueda de turnos por fecha (muy frecuente)
CREATE INDEX IF NOT EXISTS idx_agenda_fecha ON agenda_dia_profesional(fecha);

-- Búsqueda de turnos por paciente (historial)
CREATE INDEX IF NOT EXISTS idx_turno_paciente ON turno(paciente_id);

-- Búsqueda de disponibilidad activa por profesional
CREATE INDEX IF NOT EXISTS idx_disp_profesional_activo ON disponibilidad_semanal_profesional(profesional_id, activo);
```

### Consultas JPQL eficientes
```java
// MAL: N+1 queries
profesionales.forEach(p -> p.getTurnos().size()); // lazy loading en loop

// BIEN: JOIN FETCH
@Query("SELECT p FROM Profesional p LEFT JOIN FETCH p.disponibilidades WHERE p.activo = true")
List<Profesional> findActivosConDisponibilidad();
```

## Backup y restauración

El sistema tiene `BackupService` que ejecuta `pg_dump`. Verificar:
- Path de pg_dump: `C:/Program Files/PostgreSQL/18/bin/pg_dump.exe`
- Destino del backup: configurable, verificar en `application.properties`
- Credenciales: usar variables de entorno, no hardcodeadas

```bash
# Backup manual de emergencia
pg_dump -U postgres -h localhost agenda_medica > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar
psql -U postgres -h localhost agenda_medica < backup_20240615_120000.sql
```

## Instrucciones al trabajar con DB

1. Leer las migraciones existentes (V1-V4) antes de crear una nueva
2. Verificar el número correcto de la siguiente migración
3. Probar la migración SQL directamente en psql antes de ejecutar con Flyway
4. Verificar que la entidad JPA corresponde exactamente al esquema SQL
5. Si hay datos existentes, pensar en la migración de datos (no solo estructura)

$ARGUMENTS
