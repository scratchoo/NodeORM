import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// We need to change up how __dirname is used for ES6 purposes
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateMigration(migrationName, actions) {
  let tableName = null;

  // Improved table name inference patterns
  const inferTableName = (migrationName) => {
    // More specific regex patterns to extract table name
    const patterns = [
      // Pattern: addPublicationDateToPosts, removeColumnFromPosts
      /(?:add|remove|change).*?(?:To|From)(\w+)$/,
      
      // Pattern: addPublicationDate, removeColumn with singular/plural forms
      /^(?:add|remove|change)(\w+)s?$/
    ];

    for (const pattern of patterns) {
      const match = migrationName.match(pattern);
      if (match) {
        // Convert to lowercase to standardize table names
        return match[1].toLowerCase();
      }
    }

    return null;
  };

  // First, check if a table is explicitly provided in the actions
  const tableArg = actions.find(arg => arg.hasOwnProperty('table'));
  if (tableArg) {
    tableName = tableArg.table;
  } else {
    // Try to infer table name from migration name
    tableName = inferTableName(migrationName);
  }

  // If still no table name, look for table name in the first field argument
  if (!tableName) {
    const fieldArg = actions.find(arg => arg.type === 'addColumn' || arg.hasOwnProperty('column'));
    if (fieldArg && fieldArg.column) {
      // Try to infer table name from the column name (e.g., 'post_id' -> 'posts')
      const columnMatch = fieldArg.column.match(/^(\w+)_id$/);
      if (columnMatch) {
        tableName = columnMatch[1] + 's'; // Convert to plural
      }
    }
  }

  // Final check - if still no table name, exit with error
  if (!tableName) {
    console.log('Error: Could not infer table name from migration name. Please specify it using "table:<table_name>"');
    process.exit(1);
  }

  console.log(`Table determined: ${tableName}`);

  // Create the migration file content
  const migrationDir = path.join(__dirname, '../../migrations');
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, ''); // Timestamp for unique filenames
  const migrationFileName = `${timestamp}_${migrationName}.js`; // Name the migration file based on timestamp and migration name
  const migrationFilePath = path.join(migrationDir, migrationFileName);

  // Ensure the migrations directory exists
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
    console.log(`Directory ${migrationDir} created.`);
  }

  // Start the migration class structure
  let migrationContent = `import Migration from '../orm/migration'; // Assuming you have a base migration class\n\n`;
  migrationContent += `class ${migrationName} extends Migration {\n`;
  migrationContent += `  async change() {\n`;

  // Loop through the actions and generate the corresponding migration methods
  actions.forEach(action => {
    if (action.type === 'addIndex') {
      migrationContent += `    this.addIndex('${tableName}', '${action.column}', ${JSON.stringify(action.options)});\n`;
    } else if (action.type === 'removeIndex') {
      migrationContent += `    this.removeIndex('${tableName}', '${action.column}');\n`;
    } else if (action.type === 'addColumn') {
      migrationContent += `    this.addColumn('${tableName}', '${action.column}', ${JSON.stringify(action.options)});\n`;
    } else if (action.type === 'removeColumn') {
      migrationContent += `    this.removeColumn('${tableName}', '${action.column}');\n`;
    } else if (action.type === 'changeColumn') {
      migrationContent += `    this.changeColumn('${tableName}', '${action.column}', ${JSON.stringify(action.options)});\n`;
    }
  });

  // Close the class
  migrationContent += `  }\n`;
  migrationContent += `}\n\n`;
  migrationContent += `module.exports = ${migrationName};\n`;

  // Write the migration content to the file
  fs.writeFileSync(migrationFilePath, migrationContent, 'utf8');
  console.log(`Migration file generated at: ${migrationFilePath}`);

  // Explicitly exit the process
  process.exit(0);
}

export default generateMigration;




