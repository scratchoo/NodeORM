export default class Migration {
  constructor(db, direction = 'up') {
    this.db = db; // Database client
    this.direction = direction; // 'up' or 'down'
  }

  async execute(query) {
    console.log(`Executing SQL: ${query}`);
    await this.db.query(query);
  }

  // Create Table
  async createTable(tableName, callback) {
    if (this.direction === 'up') {
      let columns = [];
      const table = this._buildTableObject(columns);
      callback(table);
      const columnsSQL = columns.join(', ');
      const query = `CREATE TABLE "${tableName}" (${columnsSQL});`;
      await this.execute(query);
    } else {
      const query = `DROP TABLE IF EXISTS "${tableName}";`;
      await this.execute(query);
    }
  }

  // Add Column
  async addColumn(tableName, columnName, type, options = {}) {
    if (this.direction === 'up') {
      const columnSQL = this._buildColumn(columnName, type, options);
      const query = `ALTER TABLE "${tableName}" ADD COLUMN ${columnSQL};`;
      await this.execute(query);
    } else {
      const query = `ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}";`;
      await this.execute(query);
    }
  }

  // Remove Column
  async removeColumn(tableName, columnName) {
    if (this.direction === 'up') {
      const query = `ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}";`;
      await this.execute(query);
    } else {
      throw new Error(
        `Cannot reverse removeColumn. Please use addColumn explicitly in down().`
      );
    }
  }

  // Change Column
  async changeColumn(tableName, columnName, newType, options = {}) {
    if (this.direction === 'up') {
      const columnSQL = `${columnName} TYPE ${newType}`;
      const query = `ALTER TABLE "${tableName}" ALTER COLUMN ${columnSQL};`;
      await this.execute(query);
    } else {
      throw new Error(
        `Cannot reverse changeColumn. Please manually define down().`
      );
    }
  }

  // Add Index
  async addIndex(tableName, columnName, options = {}) {
    if (this.direction === 'up') {
      const unique = options.unique ? 'UNIQUE' : '';
      const query = `CREATE ${unique} INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON "${tableName}"(${columnName});`;
      await this.execute(query);
    } else {
      const query = `DROP INDEX IF EXISTS idx_${tableName}_${columnName};`;
      await this.execute(query);
    }
  }

  // Helper for table definition
  _buildTableObject(columns) {
    return {
      string: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'VARCHAR(255)', options));
      },
      text: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'TEXT', options));
      },
      integer: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'INTEGER', options));
      },
      bigInteger: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'BIGINT', options));
      },
      float: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'REAL', options));
      },
      decimal: (name, options = { precision: 10, scale: 2 }) => {
        const { precision, scale } = options;
        columns.push(this._buildColumn(name, `DECIMAL(${precision}, ${scale})`, options));
      },
      json: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'JSON', options));
      },
      jsonb: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'JSONB', options));
      },
      boolean: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'BOOLEAN', options));
      },
      date: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'DATE', options));
      },
      timestamp: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'TIMESTAMP', options));
      },
      uuid: (name, options = {}) => {
        columns.push(this._buildColumn(name, 'UUID', options));
      },
    };
  }

  // Build column definition
  _buildColumn(name, type, options, alter = false) {
    let column = `"${name}" ${type}`;
    if (options.null === false) column += ' NOT NULL';
    if (options.default !== undefined) {
      const defaultValue = typeof options.default === 'string' ? `'${options.default}'` : options.default;
      column += ` DEFAULT ${defaultValue}`;
    }

    if (alter) {
      return `${name} TYPE ${type}`;
    }

    return column;
  }
}
