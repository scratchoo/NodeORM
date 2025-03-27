import pg from 'pg';
const { Pool } = pg;

export default class ORM {
  constructor(config) {
    this.pool = new Pool(config);
  }

  async query(sql, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}

