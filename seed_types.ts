
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://woop:woop_password@localhost:5434/woop_db';

const pool = new Pool({
  connectionString,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Connected to database...');

    // Drop table if exists to start fresh
    await client.query(`DROP TABLE IF EXISTS all_types_test`);

    // Create table with various data types
    await client.query(`
      CREATE TABLE all_types_test (
        id SERIAL PRIMARY KEY,
        name_text TEXT,
        short_code VARCHAR(10),
        count_int INTEGER,
        score_float DOUBLE PRECISION,
        is_active BOOLEAN,
        birth_date DATE,
        last_login TIMESTAMP,
        meta_json JSONB
      )
    `);

    console.log('Table all_types_test created.');

    const rowCount = 200; // Big enough to test scrolling/pagination
    const batchSize = 50;
    
    console.log(`Generating ${rowCount} rows...`);

    const booleanValues = [true, false];

    for (let i = 0; i < rowCount; i += batchSize) {
        const values: any[] = [];
        const placeholders: string[] = [];
        
        for (let j = 0; j < batchSize && (i + j) < rowCount; j++) {
            const idx = i + j;
            const paramOffset = j * 8; // 8 columns excluding ID
            
            placeholders.push(`($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5}, $${paramOffset + 6}, $${paramOffset + 7}, $${paramOffset + 8})`);
            
            values.push(
                `User ${idx}`, // name_text
                `US-${idx % 100}`, // short_code
                Math.floor(Math.random() * 1000), // count_int
                (Math.random() * 100).toFixed(2), // score_float
                booleanValues[Math.floor(Math.random() * 2)], // is_active
                new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0], // birth_date
                new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(), // last_login
                JSON.stringify({ tag: `tag-${idx}`, level: idx % 5 }) // meta_json
            );
        }

        const query = `
            INSERT INTO all_types_test (name_text, short_code, count_int, score_float, is_active, birth_date, last_login, meta_json)
            VALUES ${placeholders.join(', ')}
        `;

        await client.query(query, values);
        process.stdout.write('.');
    }

    console.log('\nSeeding complete!');

  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
