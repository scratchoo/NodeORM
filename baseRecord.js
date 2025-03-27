import ORM from "./utils/orm.js";
// import inflection from 'inflection';

import {
  isInteger, 
  isStrictPlainObject, 
  isString
} from './utils/helpers.js';

export default class BaseRecord{

  static orm = new ORM({
    user: 'admin',
    password: 'admin',
    host: 'localhost',
    database: 'nodeorm',
    port: 5432,
  });

  // Private fields
  #_associations;
  #_queries;
  #_conditions;
  #_joins;
  #_action;
  #_updateData;
  #_assoc;
  #_orderBy;
  #_groupBy;
  #_limit;
  #_fields;
  #_delete;

  constructor(options={}){
    this.#_associations = {};
    this.#_queries = []; // could be multiple separate requests when chaining association(s) calls
    
    this.#_conditions = {};
    this.#_joins = [];
    this.#_action = null;
    this.#_updateData = {};
    this.#_assoc = null;
    this.#_orderBy = [];
    this.#_groupBy = [];  // Add #_groupBy property
    this.#_limit = null;
    this.#_fields = [];
    this.table = options.table;
    this.returnsCollection = false;
    this.#_delete = null;

    // if(options.relations){
    //   const relations = options.relations.bind(this);
    //   relations();
    // }
  }

  // ===========================================================================
  // can only be called on instance record
  getAssoc(associationName){

    if(this.returnsCollection){
      throw new Error(`getAssoc() can't be called on multiple records array!`);
    }

    if (!this.currentModel._associations[associationName]) {
      throw new Error(`Association '${associationName}' is not defined.`);
    }

    // build query based on the last accumulated query conditions, limit, order etc
    if(!this.#_assoc || this.#_assoc != associationName){ // if there is no assoc handled yet then build a query for the initial record
      const query = this.buildQuery();
      this.#_queries.push({model: this, query: query});
      // reset all previous conditions...
      this._resetQueryState();
      // build query for this association
      this.referenceModel = this.currentModel;
    }

    
    const association = this.referenceModel._associations[associationName];
    
    // change current model to the association's model
    this.currentModel = association.targetModel;
    this.currentTable = association.targetModel.table();
    
    const condition = {};

    if(association.relationType === "hasMany"){
      
      condition[`${association.targetModel.table()}.${association.foreignKey}`] 
      = `${this.table()}.id`;

      this.where(condition);

    }else if(association.relationType === "hasManyThrough"){
      
      const joinAssociation = this.referenceModel._associations[association.joinAssociationName];
      
      this.referenceModel = joinAssociation.targetModel;

      condition[`${joinAssociation.targetModel.table()}.${joinAssociation.foreignKey}`] 
      = `$1`;
      console.log(condition, associationName, "oooops")
      this.where(condition);

      let joinQuery = '';

      const joinAssociationRef = `${association.joinModel.table()}.${association.foreignKey}`;
  
      let recordRef = `${(association.targetModel.table())}.id`;
      
      // if(association.relationType === "belongsTo"){
      //   recordRef = `${this.table()}.${associationName}_id`;
      // }

      joinQuery += `INNER JOIN ${association.joinModel.table()} ON ${joinAssociationRef} = ${recordRef}`
          
      joinQuery += " ";

      joinQuery = joinQuery.trim();

      if(joinQuery !== ''){
        // this.#_joins.push(association);
        this.#_joins.push(joinQuery)
      }
    
    }else if(association.relationType === "belongsTo"){

      condition[`${association.targetModel.table()}.id`] 
      = `$1`;

      this.where(condition);
      this.limit(1);
    
    }

    const query = this.buildQuery(association);
    // this.#_queries.push({model: association.targetModel, query: query});

    // set the new called association
    this.#_assoc = associationName;

    this.returnsCollection = true;
    
    return this;
  }

  /**
   * Add joins to the query with optional conditions.
   */
  // can only be called on array of records
  joins(...associations) {
    if(!this.returnsCollection){
      throw new Error(`joins() can't be called on an instance of ${this.table()}`)
    }
    this.setJoins(associations);
    return this;
  }
  // ===========================================================================

  buildQuery(){
    let table;
    
    if(this.currentTable){
      table = this.currentTable;
    }else{
      table = this.table();
    }

    const fields = this.getFields();

    let query = `SELECT ${fields} FROM ${table}`;
    
    if(this.#_delete){
      query = `
        BEGIN;
        DELETE FROM ${this.currentModel.table()} WHERE id = $1;
        COMMIT;
      `; 
    }
    
    const joins = this.getJoins();
    query += joins != '' ? ` ${joins}` : ''; 

    const where = this.getWhereConditions();
    query += where != '' ? ` ${where}` : ''; 
    
    const orderBy = this.getOrderBy();
    query += orderBy != '' ? ` ${orderBy}` : ''; 
    
    const groupBy = this.getGroupBy();
    query += groupBy != '' ? ` ${groupBy}` : '';
    
    const limit = this.getLimit();
    query += limit != '' ? ` ${limit}` : '';

    return query;
  }

  getFields(){
    let fields = [];
    const aggregateFunc = this.isAggregationQuery();
    if(aggregateFunc){
      // it's sufficient to just add the first item in this.#_fields[] because when using aggregate functions we reset all other fields and we just let one
      fields.push(`${this.#_fields[0]}`);
    }else{
      if(this.getSelectFields().length == 0){
        this.setSelect("*"); // I.E SELECT * FROM "users"
      }
      this.getSelectFields().forEach(field => {
        fields.push(`"${this.currentModel.table()}"."${field}"`);
      })
    }
    return fields.join(', ');
  }

  getWhereConditions(){
    
    const whereClauses = [];
    const queryParams = [];

    Object.entries(this.#_conditions || {}).forEach(([key, value]) => {
      
      if (isString(value) && this.containsOperator(value)) {
        
        const [operator, val] = value.split(' ').map(v => v.trim());
        whereClauses.push(`${key} ${operator} $${queryParams.length + 1}`);
        queryParams.push(val);
      
      } else {

        whereClauses.push(`${key} = $${queryParams.length + 1}`);
        queryParams.push(value);

      }

    });

    return whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  }

  getOrderBy(){
    // Handle ordering
    const orderByClause = this.#_orderBy.length
      ? `ORDER BY ${this.#_orderBy.map(([column, direction]) => `"${this.currentModel.table()}"."${column}" ${direction}`).join(', ')}`
      : '';
    return orderByClause;
  }

  getGroupBy(){
    return '';
  }

  getLimit(){
    if(this.#_limit){
      return `LIMIT ${this.#_limit}`;
    }
    return '';
  }

  /*
  User.joins("posts", "account")
  SELECT "users".*
  FROM "users"
  INNER JOIN "posts" ON "posts"."user_id" = "users"."id"
  INNER JOIN "accounts" ON "accounts"."id" = "users"."account_id"
  */
  getJoins(){
    const joins = (this.#_joins || []).map(joinQuery => { return joinQuery; });
    return joins.join(' ');
  }

  // ========================================================================
  // ========================================================================

  select(...fields){
    if(!this.returnsCollection){
      throw new Error(`method "select" called for an instance of ${this.currentModel.table()}`);
    }
    this.#_fields = this.#_fields.filter(item => item != '*'); // remove any existing '*' in #_fields[]
    this.setSelect(fields);
    // note: select() here should not change this.returnsCollection value (it could be proceeded by where and we should still consider it as collection)
    return this;
  }

  findBy(conditions) {
    this.setConditions(conditions);
    return this;
  }

  // i.e User.joins(:posts).find(1)
  find(id) {
    return this.findBy({id: id});
  }

  findOrFail(id) {
    return this.findBy({id: id});
  }

  where(conditions){
    return this.findBy(conditions);
  }

  all(){
    // if(Object.keys(this.#_conditions).length > 0 && this.returnsCollection){
    if(!this.returnsCollection){
      throw new Error(`all() can't be called on an instance of ${this.table()}`);
    }
    return this;
  }

  first(){
    this.setOrderBy("id", "ASC");
    this.setLimit(1);
    this.returnsCollection = false;
    return this;
  }

  last(){
    this.setOrderBy("id", "DESC"); // `"${this.table()}"."id" DESC`);
    this.setLimit(1);
    this.returnsCollection = false;
    return this;
  }

  /**
   * Add group by columns to the query.
   */
  groupBy(...columns) {
    // Merge the passed columns with existing group by columns, avoiding duplicates
    this.#_groupBy = [...new Set([...this.#_groupBy, ...columns])];
    return this; // Return the query object for chaining
  }

  limit(limit) {
    const aggregateFunc = this.isAggregationQuery();
    console.log(aggregateFunc)
    if(aggregateFunc){
      throw new Error(`limit() can't be called on ${aggregateFunc} that returns a number!`);
    }
    this.setLimit(limit);
    return this;
  }

  count(field){
    if(this.#_fields.length === 1){
      field = `"${this.table()}"."${this.#_fields[0]}"`;
    }else{
      if(field){
        field = `"${this.table()}"."${field}"`;
      }else{
        field = "*";
      }
    }
    
    this.resetSelectFields();
    this.setSelect(`COUNT(${field})`);
    this.returnsCollection = false;
    return this;
  }

  sum(field){
    if(!field){
      throw new Error("Missing argument for sum(ARG)");
    }
    this.resetSelectFields();
    this.setSelect(`SUM("${this.table()}"."${field}")`); // I.E SELECT COUNT(*) FROM "users"
    this.returnsCollection = false;
    return this;
  }

  average(field){
    if(!field){
      throw new Error("Missing argument for avg(ARG)");
    }
    this.resetSelectFields();
    this.setSelect(`AVG("${this.table()}"."${field}")`);
    this.returnsCollection = false;
    return this;
  }

  toSql(){
    // if(!this.#_assoc){
    //   const query = this.buildQuery();
    //   this.#_queries.push({model: this, query: query});
    // }
    const query = this.buildQuery();
    this.#_queries.push({model: this, query: query});
    console.log(this.#_queries)
    this._resetQueryState();
  }

  rawQuery(strQuery){

  }


  save(params={}){
    console.log(params)
    let insertionTable = '';

    if(this.#_assoc){
      insertionTable = '';
    }else{
      insertionTable = this.currentModel.table();
    }
    // check before_save
    // check validations (note that sometimes validations are set for create only)
    
    // const attributes = ["name", "email", "created_at", "updated_at"];
    // const values = ['john', 'doe', '2024-12-15 02:17:56.991222', '2024-12-15 02:17:56.991222'];
    const attributesNames = Object.keys(params).map(key => `"${key}"`);
    const attributesValues = Object.values(params).map(value => `'${value}'`);

    let queryString = `BEGIN;`;
    queryString += ' ';
    queryString += `INSERT INTO "${insertionTable}" (${attributesNames.join(', ')}) VALUES (${attributesValues.join(', ')}) RETURNING "id";`;
    queryString += ' ';
    queryString += `COMMIT`;

    throw queryString;
    return this;
  }

  saveOrFail(params={}){

  }

  create(params={}){
    this.save(params);
    return this;
  }

  createOrFail(params={}){

  }

  update(params={}){
    `BEGIN`
    `UPDATE "users" SET "name" = 'michael', "updated_at" = '2024-12-15 02:23:51.130188' WHERE "users"."id" = 2`
    `COMMIT`
  }

  destroy(){
    if(this.returnsCollection){
      throw new Error(`destroy() can't be called on multiple records array!`);
    }
    
    const query = this.buildQuery();
    this.#_queries.push({model: this.currentModel, query: query});
    // reset all previous conditions...
    this._resetQueryState();

    this.#_delete = "*";
    // console.log()
    // `BEGIN`
    // `DELETE FROM "${this.table()}" WHERE "users"."id" = 3`
    // `COMMIT`
    return this;
  }

  destroy_all(){

  }

  _resetQueryState(){
    // Reset static properties after query execution
    this.#_conditions = {};
    this.#_joins = [];
    this.#_assoc = null;
    this.#_action = null;
    this.#_updateData = {};
    this.#_orderBy = [];
    this.#_groupBy = [];
    this.#_limit = null;
    this.#_fields = [];
    this.#_delete = null;
  }

  containsOperator(str){
    return ['<', '>', '<=', '>=', '=', '!='].includes(str);
  }

  setSelect(fields){
    if(typeof fields === 'string'){
      fields = [fields]
    }else if(!Array.isArray(fields)){
      throw "setSelectFields: invalid fields! must be either an array or a string value";
    }
    this.#_fields.push(...fields);
  }

  getSelectFields(){
    return this.#_fields;
  }

  setOrderBy(column, direction){
    this.#_orderBy.push([column, direction]);
  }
  // ------------ verified -------------------

  // Public method to update conditions
  setConditions(conditions){
    if(!isStrictPlainObject(conditions)){
      throw new Error("condition should be a valid object");
    }

    if(conditions.id){
      conditions[`"${this.currentModel.table()}"."id"`] = conditions.id; // Add new key
      delete conditions.id; // Remove the old key
    }

    this.#_conditions = { ...this.#_conditions, ...conditions };
  }

  getAssociation(association){
    return (this.referenceModel || this.currentModel)._associations[association];
  }

  setJoins(associations){

    let joinQuery = '';
    
    for (const associationName of associations) {
      
      if(isStrictPlainObject(associationName)){
        throw new Error('Nested joins are not implemented yet, please your own custom JOIN statement meanwhile!');
        // https://apidock.com/rails/v5.2.3/ActiveRecord/QueryMethods/joins
        // maybe we should set a global object (aka shared.js) and put associations on it
        for (const [key, value] of Object.entries(associationName)) {
          const association1 = this.getAssociation(key);
          
          if(!association1){
            throw new Error(`${key} is not a valid association`);
          }
          let associationRef = `${association1.targetModel.table()}.${association1.foreignKey}`;
          let recordRef = `${this.table()}.id`;
          if(association1.relationType === "belongsTo"){
            recordRef = `${this.table()}.${key}_id`;
          }
          joinQuery += `INNER JOIN ${association1.targetModel.table()} ON ${associationRef} = ${recordRef}`
          joinQuery += " ";

          const association2 = this.getAssociation(value);
          if(!association2){
            throw new Error(`${value} is not a valid association`);
          }

          associationRef = `${association2.targetModel.table()}.${association2.foreignKey}`;
          recordRef = `${association1.targetModel.table()}.id`;
          if(association2.relationType === "belongsTo"){
            recordRef = `${association2.targetModel.table()}.${value}_id`;
          }
          joinQuery += `INNER JOIN ${association2.targetModel.table()} ON ${associationRef} = ${recordRef}`
          joinQuery += " ";

          
        }
        continue;
      }

      const association = this.getAssociation(associationName);
      
      if (association) {

        if(association.relationType === "hasManyThrough"){
          
          const joinAssociation = this.getAssociation(association.joinAssociationName);

          const joinAssociationRef = `${association.joinModel.table()}.${association.foreignKey}`;
      
          let recordRef = `${(this.referenceModel?.table() || this.table())}.id`;
          
          // if(association.relationType === "belongsTo"){
          //   recordRef = `${this.table()}.${associationName}_id`;
          // }
  
          joinQuery += `INNER JOIN ${association.joinModel.table()} ON ${joinAssociationRef} = ${recordRef}`;
          joinQuery += " ";

 
          const associationRef = `${association.targetModel.table()}.${association.foreignKey}`;
          const joinRecordRef = `${joinAssociation.targetModel.table()}.id`
          joinQuery += `INNER JOIN ${association.targetModel.table()} ON ${associationRef} = ${joinRecordRef}`

          joinQuery += " ";

        }else{

          const associationRef = `${association.targetModel.table()}.${association.foreignKey}`;
      
          let recordRef = `${(this.referenceModel?.table() || this.table())}.id`;
          
          if(association.relationType === "belongsTo"){
            recordRef = `${this.table()}.${associationName}_id`;
          }
  
          joinQuery += `INNER JOIN ${association.targetModel.table()} ON ${associationRef} = ${recordRef}`
          
          joinQuery += " ";

          this.referenceModel = association.targetModel;

        }
       
      
      }else if(isString(associationName)){
        joinQuery += associationName;
      }else{
        throw new Error(`Invalid argument type: ${associationName}`);
      }
      
    }

    joinQuery = joinQuery.trim();

    if(joinQuery !== ''){
      // this.#_joins.push(association);
      this.#_joins.push(joinQuery)
    }
    
  }

  setGroupBy(columns){
    this.#_groupBy = [...new Set([...this.#_groupBy, ...columns])]
  }

  setLimit(limit){
    if(!limit){
      throw new Error(`Invalid number of arguments for limit(ARG)`);
    }
    if(!isInteger(limit)){
      throw new Error(`Invalid argument type for limit(ARG). Argument must be a number!`);
    }
    this.#_limit = limit;
  }
  
  resetSelectFields(){
    this.#_fields = [];
  }

  isAggregationQuery(){
    // it's sufficient to check on the first item on this.#_fields[] because when we call aggregate functions (like avg, sum, count) we reset all other fields and we just push that aggregate function on fields
    const firstSelectField = this.#_fields[0];
    if(!firstSelectField){
      return false;
    }
    for (const aggregateFunc of ['COUNT', 'AVG', 'SUM']) {
      if(firstSelectField.startsWith(aggregateFunc)){
        return aggregateFunc;
      }
    }
    return false;
  }

  /**
   * Build and execute the query.
   */
  async execute() {
    const { sql, queryParams } = this.buildQuery();
    const rows = await this.orm.query(sql, queryParams);

    this.currentModel = null; // don't forget to reset current model

    let targetModel;
    if (this._assoc) {
      const relation = this.relations[this._assoc];
      targetModel = relation.targetModel;
    }

    if(!targetModel){
      targetModel = this;
    }

    const action = this._action;
    this._resetQueryState();

    // Return the appropriate result based on the action
    if (action === 'findOne') {
      return rows.length ? new targetModel(rows[0]) : null;
    }
    return rows.map(row => new targetModel(row));
  }

  getOne(){
    if(this.#_queries.length == 0){
      const targetModel = this;
      return new targetModel(rows[0])
    }else{

    }
  }

  getAll(){
    if(this.#_queries.length == 0){
      const targetModel = this;
      return new targetModel(rows[0])
    }else{

    }
  }

}