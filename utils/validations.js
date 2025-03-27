export function presence(){

}

export function uniqueness(){
  
}

export function validate(attributes, validations){
  const model = this;
  attributes.split(',')
  attributes = attributes.split(",").map(attr => attr.trim());
  attributes.forEach(attribute => {
    for (const [validationName, value] of Object.entries(validations)) {
      // validationName like "presence", i.e {presence: true}
      // in that case we call the method presence() dynamically
      this[validationName](value, attribute, model);
    }
  });
}

export function presence(val, attribute, model){
  if(val==true){
    if(!model[attribute]){
      model.isValid = false;
      model.errors = model.errors || [];
      const error = {};
      error[attribute] = "can't be blank";
      model.errors.push(error);
    }else{
      model.isValid = true;
    }
  }
}