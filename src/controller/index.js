'use strict';

import Base from './base.js';
import md5File from 'md5-file';
import _ from 'lodash';
import fs from 'fs';

export default class extends Base {
  indexAction(){
    return this.redirect('/user');
  }

  articleAction(){
    return this.display();
  }

  async formTmplContentAction(){
    let { id } = this.param();
    let form_tmpl = await this.model('form_tmpl').where({id}).find();
    return this.success(form_tmpl.content);
  }

  async workflowTypeAction(){
    let { id } = this.param();
    let item = await this.model('workflow_type').where({id}).find();
    return this.success(item);
  }

  uploadAction(){
    let md5List = _.map(this.file(),o=>{
      let md5 = md5File.sync(o.path);
      fs.renameSync(o.path, think.RUNTIME_PATH + '/' + md5);
      return md5;
    });
    return this.success(md5List);
  }

  async imageAction(){
    let { id, hash } = this.param();
    if(id){
      let item = await this.model('attach').where({id}).find();
      hash = item.hash;
    }
    fs.createReadStream(think.RUNTIME_PATH + '/' + hash).pipe(this.http.res);
  }

}
