import BaseRecord from "./baseRecord.js";
// import {RecordNotFoundError} from "./utils/customErrors.js";
// throw new ValidationError("Couldn't find User with 'id'=1 (ActiveRecord::RecordNotFound)");
export default class Model{

  constructor(data = {}) {
    Object.assign(this, data);
  }

  static table() {
    throw new Error("Table name is not defined. Ensure your model includes a static table() method that returns the table name.");
  }

  // ========================================================================
  // ========================================================================

  static findBy(conditions, opts={}) {

    return this.buildRecord((baseRecord) => {
      baseRecord.setConditions(conditions);
      if(opts.returnsCollection){
        baseRecord.returnsCollection = true;
      }
      if(opts.getOne !== false){
        baseRecord.setLimit(1);
      }
    });

  }

  static find(id) {
    return this.findBy({id: id}, {returnsCollection: false, getOne: true});
  }

  static where(conditions){
    return this.findBy(conditions, {returnsCollection: true, getOne: false});
  }

  static count(field){
    return this.buildRecord((baseRecord) => {
      baseRecord.count(field);
    });
  }

  static average(field){
    return this.buildRecord((baseRecord) => {
      baseRecord.average(field);
    });
  }

  static sum(field){
    return this.buildRecord((baseRecord) => {
      baseRecord.sum(field);
    });
  }

  static all(){
    return this.buildRecord((baseRecord) => {
      baseRecord.setSelect("*"); // I.E SELECT * FROM "users"
      baseRecord.returnsCollection = true;
    });
  }

  static select(...fields){
    return this.buildRecord((baseRecord) => {
      baseRecord.setSelect(fields); // I.E SELECT * FROM "users"
      baseRecord.returnsCollection = true;
    });
  }

  static first(){
    return this.buildRecord((baseRecord) => {
      baseRecord.first();
    });
  }

  static last(){
    return this.buildRecord((baseRecord) => {
      baseRecord.last();
    });
  }

  // ------------ verified -------------------


  static include(...associations){
    return this.buildRecord((baseRecord) => {
      baseRecord.setSelect("*"); // I.E SELECT * FROM "users"
      baseRecord.setInclude(associations);
    })
  }

  static preload(){
    
  }

  /**
   * Add joins to the query with optional conditions.
   */
  static joins(...associations) {
    return this.buildRecord((baseRecord) => {
      baseRecord.returnsCollection = true; // make sure to set this here before calling baseRecord.joins()
      baseRecord.joins(associations);
    })
  }

  /**
   * Add group by columns to the query.
   */
  static groupBy(...columns) {
    return this.buildRecord((baseRecord) => {
      baseRecord.setGroupBy(columns);
    });
  }

  static limit(limit) {
    return this.buildRecord((baseRecord) => {
      baseRecord.setLimit(limit);
    });
  }

  static having() {
    // ????????
  }

  // ========================================================================
  // ========================================================================

  

  /**
   * Define associations for relationships.
   */
  // static defineRelation(associationName, relationType, targetModel, foreignKey) {
  //   this._associations[associationName] = { relationType, targetModel, foreignKey };
  // }

  static buildRecord(fn){
    const options = {table: this.table}
    
    if(typeof this.relations == 'function'){
      // options.relations = this.relations;
      this.relations();
    }
    
    const baseRecord = new BaseRecord(options);
    
    baseRecord.currentModel = this;

    // Merge the passed columns with existing group by columns, avoiding duplicates
    fn(baseRecord);

    return baseRecord; // Return the query object for chaining
  }

  static hasMany(associationName, targetModel, foreignKey){
    

    const relationType = "hasMany";
    this._associations = this._associations || {};
    this._associations[associationName] = { relationType, targetModel, foreignKey };
    // console.log(this.#_associations[associationName])

    console.log("==============================")
    console.log(this);
    console.log("==============================")

    if(typeof targetModel.relations == 'function'){
      // const relations = targetModel.relations.bind(this);
      // relations();
      targetModel.relations();
      // console.log(targetModel)
      
    }
  }

  static belongsTo(associationName, targetModel, foreignKey="id"){
    // console.log("**************************")
    // console.log(this)
    // console.log("**************************")

    const relationType = "belongsTo";
    this._associations = this._associations || {};
    this._associations[associationName] = { relationType, targetModel, foreignKey };
  }

  static hasManyThrough(associationName, throughAssociationName, foreignKey){
    const relationType = "hasManyThrough";
    if(!this._associations){
      throw new Error(`Enable to set hasManyThrough: association ${throughAssociationName} couldn't be found!`);
    }
    const through = this._associations[throughAssociationName]
    if(!through){
      throw new Error(`Enable to set hasManyThrough: association ${throughAssociationName} couldn't be found!`);
    }
    this._associations[associationName] = { relationType, targetModel: through.targetModel._associations[associationName].targetModel, foreignKey, joinModel: through.targetModel, joinAssociationName:  throughAssociationName}
  }

  static hasOne(associationName, targetModel, foreignKey){
    const relationType = "hasOne";
    this._associations = this._associations || {};
    this._associations[associationName] = { relationType, targetModel, foreignKey };

    // if(typeof targetModel.relations == 'function'){
    //   const relations = targetModel.relations.bind(this);
    //   relations();
    // }
  }

  static validates(){
    throw "TO BE IMPLEMENTED!!!!"
  }

}