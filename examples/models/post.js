import Model from '../../model.js';

class Post extends Model {
  static table() {
    return 'posts';
  }

  static relations() {
    this.belongsTo("user", User, 'user_id')
    this.hasMany("comments", Comment, 'post_id');
    
  }
}


export default Post;