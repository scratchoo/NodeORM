import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import generateMigration from './migrationGenerator.js';

// We need to change up how __dirname is used for ES6 purposes
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt the user
const promptUser = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Model Generator
async function generateModel(modelName, fields, tableName) {
  const modelFileName = `${modelName}.js`; // Correct the model filename using template literals
  const modelFilePath = path.join(__dirname, '../../models', modelFileName);

  // Check if the model file already exists and prompt for confirmation
  if (fs.existsSync(modelFilePath)) {
    const overwrite = await promptUser(`The file ${modelFileName} already exists. Do you want to overwrite it? (y/n): `);
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Model generation aborted.');
      rl.close();  // Close the readline interface
      return;
    }
  }

  // Generate Model Content
  const modelContent = `
import Model from '../orm/model.js';

class ${modelName} extends Model {
  static table() {
    return '${tableName}'; // Use the table name passed in the command
  }

  static schema() {
    return {
      ${fields.map(field => `'${field.name}': { type: '${field.type}', options: ${JSON.stringify(field.options)} }`).join(',\n\t\t\t')}
    };
  }
  
  static relations() { 
    // Define model relations here
  }

  static validations() {
    // Define model validations here
  }

  static callbacks() {
    // Define model callbacks here
  }
}

export default ${modelName};
`;

  const modelsDir = path.join(__dirname, '../../models'); // Save model file in the 'models' directory
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir);
  }

  fs.writeFileSync(modelFilePath, modelContent, 'utf8');
  console.log(`Model file created: ${modelFileName}`);

  // Generate Migration for the Model
  const migrationName = `Create${modelName.charAt(0).toUpperCase() + modelName.slice(1)}sTable`; // Capitalize model name for the migration
  const migrationActions = [
    {
      type: 'createTable',
      table: tableName,
      options: fields
    }
  ];

  generateMigration(migrationName, migrationActions);
  rl.close(); // Close the readline interface
}

export default generateModel;
