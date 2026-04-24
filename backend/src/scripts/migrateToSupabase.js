require('dotenv').config();
const { Sequelize } = require('sequelize');

// 1. Initialize Local Local PostgreSQL
const localDb = new Sequelize({
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
});

// 2. Initialize Remote Supabase PostgreSQL
const SUPABASE_URL = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_URL.startsWith('postgresql://')) {
  console.log('❌ Please provide your Supabase Connection String as an argument.');
  console.log('Example: node migrateToSupabase.js "postgresql://postgres:...@...supabase.com:5432/postgres"');
  process.exit(1);
}

const remoteDb = new Sequelize(SUPABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

async function migrateData() {
  try {
    console.log('⏳ Connecting to Local DB...');
    await localDb.authenticate();
    
    console.log('⏳ Connecting to Supabase DB...');
    await remoteDb.authenticate();

    // Tables we care about transferring (in order to respect foreign keys)
    const tables = ['users', 'election_results']; 

    for (const table of tables) {
      console.log(`\n📦 Reading table: ${table} from local...`);
      const [results] = await localDb.query(`SELECT * FROM ${table};`);
      
      if (results.length === 0) {
        console.log(`   - 0 rows found. Skipping.`);
        continue;
      }

      console.log(`   - Found ${results.length} rows. Injecting into Supabase...`);
      
      for (const row of results) {
        const columns = Object.keys(row).map(c => `"${c}"`).join(', ');
        // Properly escape values (string vs num vs object for JSONB)
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'object' && v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          return v;
        }).join(', ');

        const query = `INSERT INTO ${table} (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;`;
        await remoteDb.query(query);
      }
      console.log(`   ✅ Migration for ${table} complete.`);
    }

    console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY TO SUPABASE!');
    process.exit(0);

  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    process.exit(1);
  }
}

migrateData();
