import { Sequelize, DataTypes, Op } from 'sequelize';
import pg from 'pg';
import dotenv from 'dotenv';
import sqliteAdapter from '../utils/sqliteAdapter.js';

dotenv.config();
const dbUrl = process.env.DATABASE_URL || process.env.DB_URL || '';
const dbDialect = process.env.DB_DIALECT || 'postgres';
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'hospitaldb';

let sequelize;

if (dbDialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || `${dbName}.sqlite`,
    dialectModule: sqliteAdapter,
    logging: false,
    define: {
      timestamps: false,
      underscored: true
    }
  });
} else if (dbUrl) {

  sequelize = new Sequelize(dbUrl, {
  dialect: dbDialect,
  dialectModule: dbDialect === 'postgres' ? pg : undefined,
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

} else {
  console.log(`Connecting to database via URL: ${dbUrl}`);
  sequelize = new Sequelize(
    dbName,
    dbUser,
    dbPassword,
    {
      host: dbHost,
      port: dbPort,
      dialect: dbDialect,
      logging: false,
      define: {
    timestamps: false,
    underscored: true
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
    }
  );
  console.log(`Database connection established to ${dbUser}@${dbHost}:${dbPort}/${dbName}`);
}

if (!sequelize) {
  console.error('No database configuration found. Please set DATABASE_URL or DB_HOST/DB_NAME in your environment.');
}
export { Op, DataTypes } from 'sequelize';

export async function initSchema() {
  await sequelize.authenticate();
  await sequelize.sync();

  const queryInterface = sequelize.getQueryInterface();
  const staffColumns = await queryInterface.describeTable('staff');

  if (!staffColumns.email) {
    await queryInterface.addColumn('staff', 'email', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
  }

  const emailExpression = dbDialect === 'sqlite'
    ? "id || '@hospital.local'"
    : "CONCAT(id, '@hospital.local')";
  await sequelize.query(`UPDATE staff SET email = ${emailExpression} WHERE email IS NULL`);

  await queryInterface.changeColumn('staff', 'email', {
    type: DataTypes.STRING(255),
    allowNull: false
  });
}
export {sequelize}
