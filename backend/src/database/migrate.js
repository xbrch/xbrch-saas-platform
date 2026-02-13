const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('Starting database migration...');
    
    // Read and execute SQL migration file
    const migrationPath = path.join(__dirname, 'schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Database migration completed successfully!');
    
    // Create default admin user if not exists
    const adminEmail = 'admin@xbrch.com';
    const adminPassword = 'admin123'; // Should be changed in production
    
    // Check if admin exists
    const adminExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [adminEmail, 'admin']
    );
    
    if (adminExists.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      await pool.query(
        `INSERT INTO users (email, password_hash, role, plan, monthly_limit, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [adminEmail, hashedPassword, 'admin', 'authority', 10000]
      );
      
      console.log('✅ Default admin user created');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log('   ⚠️  Please change this password in production!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
