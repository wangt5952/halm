'use strict';
/**
 * model
 */
import _ from 'lodash';

export default class extends think.model.base {

  async findTree(where, type){
    let archive = await this.where(where).find();

    let tree = [];
    if(!think.isEmpty(archive)){
      let where = {archive_id:archive.id};
      if(type == 'dir') where.hash = null;

      let list = await this.model('archive_item').where(where).select();

      await Promise.all(_.map(list, async o=>{
        let children = _.filter(list, {parent_id:o.id});
        if(children.length) o.children = children;
      }));

      tree = _.filter(list, {parent_id:null});
    }

    return tree;
  }

  async addTree(opts, tree){
    await Promise.all(_.map(tree, async (o,i)=>{
      let id = await this.model('archive').add({sort:i, ...opts, ...o});
      if(o.children){
        let opts2 = { ...opts, parent_id:id};
        await this.addTree(opts2, o.children);
      }
    }))
  }

  async findPath(archive_id, item_id){
    let dirList = await this.model('archive_item').where({hash:null,archive_id}).select();
    let pathList = [];
    while(item_id){
      let dir = _.find(dirList, {id:item_id});
      pathList.push(dir);
      item_id = dir.parent_id;
    }
    return pathList;
  }

  async findAdjacencyTree(where, type){
    let archive = await this.where(where).find();

    let tree = [];
    if(!think.isEmpty(archive)){
      let where = {archive_id:archive.id};
      if(type == 'dir') where.hash = null;

      let list = await this.model('archive_item').where(where).select();

      tree = _.map(list, o=>({
        ...o,
        level: o.parent_id ? 1 : 0,
        isLeaf: false,loaded:true,expanded:true
      }));
    }

    return tree;
  }
}
