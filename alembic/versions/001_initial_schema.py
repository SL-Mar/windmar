"""Initial schema: core tables + weather forecast tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-02-12

Baseline migration capturing the existing database schema.
Tables were originally created by docker/init-db.sql and
runtime CREATE TABLE statements in weather_ingestion.py.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # --- Core tables (from init-db.sql) ---

    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), primary_key=True),
        sa.Column("key_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("rate_limit", sa.Integer(), server_default=sa.text("1000")),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("idx_api_keys_key_hash", "api_keys", ["key_hash"])
    op.create_index("idx_api_keys_active", "api_keys", ["is_active"], postgresql_where=sa.text("is_active = true"))

    op.create_table(
        "vessel_specs",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("length", sa.Float(), nullable=False),
        sa.Column("beam", sa.Float(), nullable=False),
        sa.Column("draft", sa.Float(), nullable=False),
        sa.Column("displacement", sa.Float(), nullable=False),
        sa.Column("deadweight", sa.Float(), nullable=False),
        sa.Column("block_coefficient", sa.Float()),
        sa.Column("midship_coefficient", sa.Float()),
        sa.Column("waterplane_coefficient", sa.Float()),
        sa.Column("lcb_fraction", sa.Float()),
        sa.Column("propeller_diameter", sa.Float()),
        sa.Column("max_speed", sa.Float()),
        sa.Column("service_speed", sa.Float()),
        sa.Column("engine_power", sa.Float()),
        sa.Column("fuel_type", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", postgresql.UUID()),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("idx_vessel_specs_name", "vessel_specs", ["name"])

    op.create_table(
        "routes",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), primary_key=True),
        sa.Column("vessel_id", postgresql.UUID(), sa.ForeignKey("vessel_specs.id")),
        sa.Column("origin_lat", sa.Float(), nullable=False),
        sa.Column("origin_lon", sa.Float(), nullable=False),
        sa.Column("destination_lat", sa.Float(), nullable=False),
        sa.Column("destination_lon", sa.Float(), nullable=False),
        sa.Column("departure_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("route_data", postgresql.JSONB(), nullable=False),
        sa.Column("total_distance", sa.Float()),
        sa.Column("total_time", sa.Float()),
        sa.Column("fuel_consumption", sa.Float()),
        sa.Column("calculation_time", sa.Float()),
        sa.Column("weather_data_source", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", postgresql.UUID()),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("idx_routes_vessel_id", "routes", ["vessel_id"])
    op.create_index("idx_routes_created_at", "routes", ["created_at"])

    op.create_table(
        "calibration_data",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), primary_key=True),
        sa.Column("vessel_id", postgresql.UUID(), sa.ForeignKey("vessel_specs.id")),
        sa.Column("speed", sa.Float(), nullable=False),
        sa.Column("fuel_consumption", sa.Float(), nullable=False),
        sa.Column("wind_speed", sa.Float()),
        sa.Column("wind_direction", sa.Float()),
        sa.Column("wave_height", sa.Float()),
        sa.Column("current_speed", sa.Float()),
        sa.Column("current_direction", sa.Float()),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_source", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("idx_calibration_vessel_id", "calibration_data", ["vessel_id"])
    op.create_index("idx_calibration_recorded_at", "calibration_data", ["recorded_at"])

    op.create_table(
        "noon_reports",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), primary_key=True),
        sa.Column("vessel_id", postgresql.UUID(), sa.ForeignKey("vessel_specs.id")),
        sa.Column("route_id", postgresql.UUID(), sa.ForeignKey("routes.id")),
        sa.Column("position_lat", sa.Float(), nullable=False),
        sa.Column("position_lon", sa.Float(), nullable=False),
        sa.Column("speed_over_ground", sa.Float()),
        sa.Column("speed_through_water", sa.Float()),
        sa.Column("course", sa.Float()),
        sa.Column("fuel_consumed", sa.Float()),
        sa.Column("distance_made_good", sa.Float()),
        sa.Column("weather_conditions", postgresql.JSONB()),
        sa.Column("report_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("idx_noon_reports_vessel_id", "noon_reports", ["vessel_id"])
    op.create_index("idx_noon_reports_route_id", "noon_reports", ["route_id"])
    op.create_index("idx_noon_reports_time", "noon_reports", ["report_time"])

    # updated_at trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql'
    """)
    op.execute("""
        CREATE TRIGGER update_vessel_specs_updated_at
        BEFORE UPDATE ON vessel_specs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)

    # --- Weather forecast tables (created at runtime by weather_ingestion.py) ---

    op.create_table(
        "weather_forecast_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("run_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("status", sa.String(20), server_default=sa.text("'ingesting'")),
        sa.Column("grid_resolution", sa.Float(), nullable=False),
        sa.Column("lat_min", sa.Float(), nullable=False),
        sa.Column("lat_max", sa.Float(), nullable=False),
        sa.Column("lon_min", sa.Float(), nullable=False),
        sa.Column("lon_max", sa.Float(), nullable=False),
        sa.Column("forecast_hours", postgresql.ARRAY(sa.Integer())),
        sa.Column("metadata", postgresql.JSONB()),
        sa.UniqueConstraint("source", "run_time"),
    )
    op.create_index("idx_forecast_runs_source_status", "weather_forecast_runs", ["source", "status"])
    op.create_index("idx_forecast_runs_time", "weather_forecast_runs", ["run_time"], postgresql_using="btree",
                     postgresql_ops={"run_time": "DESC"})

    op.create_table(
        "weather_grid_data",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("weather_forecast_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("forecast_hour", sa.Integer(), nullable=False),
        sa.Column("parameter", sa.String(30), nullable=False),
        sa.Column("lats", sa.LargeBinary(), nullable=False),
        sa.Column("lons", sa.LargeBinary(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("shape_rows", sa.Integer(), nullable=False),
        sa.Column("shape_cols", sa.Integer(), nullable=False),
        sa.UniqueConstraint("run_id", "forecast_hour", "parameter"),
    )
    op.create_index("idx_grid_data_run_hour", "weather_grid_data", ["run_id", "forecast_hour"])


def downgrade() -> None:
    op.drop_table("weather_grid_data")
    op.drop_table("weather_forecast_runs")
    op.execute("DROP TRIGGER IF EXISTS update_vessel_specs_updated_at ON vessel_specs")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
    op.drop_table("noon_reports")
    op.drop_table("calibration_data")
    op.drop_table("routes")
    op.drop_table("vessel_specs")
    op.drop_table("api_keys")
