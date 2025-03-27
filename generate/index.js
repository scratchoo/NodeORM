import generateModel from './modelGenerator.js';
import generateMigration from './migrationGenerator.js';
import { fileURLToPath } from 'url';
import path from 'path';

// We need to change up how __dirname is used for ES6 purposes
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

// Handle 'generate:model' command
if (args[0] === 'model') {
  const modelName = args[1]; // Corrected to fetch the model name from the second argument
  const tableArg = args[2]; // The table argument will now be args[2]
  const fieldsArgs = args.slice(3); // Fields start from args[3]

  // Extract table name from table argument
  const tableName = tableArg.split(':')[1];

  // Parse the fields
  const fields = fieldsArgs.map(field => {
    const [name, type] = field.split(':');
    const options = {};

    // Handle special case for references
    if (type === 'references') {
      return {
        name: `${name}_id`,  // Convert 'user:references' to 'user_id'
        type: 'integer',
        options: { null: false },
      };
    }

    // Default case for other field types
    return {
      name,
      type,
      options: { null: false }, // Default option can be changed as needed
    };
  });

  // Generate the model with fields and table name
  generateModel(modelName, fields, tableName);

} else if (args[0] === 'migration') {
  const migrationName = args[1]; // Example: 'addIndexToPosts'
  
  // New approach to detect table name and fields
  let tableName = null;
  const fieldsArgs = [];

  // Improved table name detection
  const tableNamePatterns = [
    /(?:add|remove|change).*?(?:To|From)(\w+)$/,
    /(?:add|remove|change)(\w+)s?$/
  ];

  let tableNameMatch = null;
  for (const pattern of tableNamePatterns) {
    tableNameMatch = migrationName.match(pattern);
    if (tableNameMatch) {
      tableName = tableNameMatch[1].toLowerCase();
      break;
    }
  }

  // Process remaining arguments
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    // Check if argument is explicitly specifying table
    if (arg.startsWith('table:')) {
      tableName = arg.split(':')[1];
    } else {
      // Assume it's a field argument
      fieldsArgs.push(arg);
    }
  }

  // Logging for debugging
  console.log(`Migration name: ${migrationName}`);
  console.log(`Detected table name: ${tableName}`);
  console.log(`Field arguments: ${fieldsArgs}`);

  // Validate table name
  if (!tableName) {
    console.log('Error: Could not determine the table name. Please specify it using "table:<table_name>"');
    process.exit(1);
  }

  // Generate the migration actions
  const migrationActions = [];

  // Handle the index operations based on the migration name
  if (migrationName.startsWith('addIndex')) {
    const columnName = fieldsArgs[0]; // The field for the index (e.g., 'title')
    if (columnName) {
      migrationActions.push({
        type: 'addIndex',
        table: tableName,
        column: columnName,
        options: { unique: false },
      });
    } else {
      console.log('Error: No column name provided for adding index');
      process.exit(1);
    }
  } else if (migrationName.startsWith('removeIndex')) {
    const columnName = fieldsArgs[0]; // The field for removing the index (e.g., 'title')
    if (columnName) {
      migrationActions.push({
        type: 'removeIndex',
        table: tableName,
        column: columnName,
      });
    } else {
      console.log('Error: No column name provided for removing index');
      process.exit(1);
    }
  } else {
    // Handle column operations (add, remove, change)
    fieldsArgs.forEach(field => {
      const [columnName, columnType] = field.split(':');
      if (!columnName || !columnType) {
        console.log(`Skipping invalid field: ${field}`);
        return;
      }

      const options = { null: true };

      if (columnType === 'datetime') {
        options.default = 'CURRENT_TIMESTAMP';
      }

      if (migrationName.startsWith('remove')) {
        migrationActions.push({
          type: 'removeColumn',
          table: tableName,
          column: columnName,
        });
      } else if (migrationName.startsWith('add')) {
        migrationActions.push({
          type: 'addColumn',
          table: tableName,
          column: columnName,
          options,
        });
      } else if (migrationName.startsWith('change')) {
        migrationActions.push({
          type: 'changeColumn',
          table: tableName,
          column: columnName,
          options,
        });
      }
    });
  }

  if (migrationActions.length === 0) {
    console.log('No valid fields provided for migration');
    process.exit(1);
  }

  // Call the migration generator
  generateMigration(migrationName, migrationActions);
} else {
  console.log('Usage: node generate:model <model_name> <fields> or node generate:migration <migration_name> <fields>');
}