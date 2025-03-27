import Post from "./models/post.js";

export default class PostsController{

  async index(){

    const query = Post.all().toSql();

    console.log(query);

  }

}