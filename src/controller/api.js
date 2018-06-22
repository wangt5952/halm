'use strict';

import Base from './base.js';
import _ from 'lodash';
import moment from 'moment';
import md5File from 'md5-file';
import fs from 'fs';

export default class extends Base {
  async loginAction(){
    let { account, password} = this.param();

    let user = await this.model('user').where({'username|mobile|idno':account, password}).find();
    if(!think.isEmpty(user)){
      let token = new Buffer(user.id+'|'+moment().unix()).toString('base64');
      let projectList = await this.model('v_user_project').where({user_id:user.id}).select();
      return this.success({
        token, projectList
      });
    }
    else return this.fail(1,'错误的用户名或密码');
  }

  async signAction(){
    let { token, ...oth } = this.param();
    let [user_id, unixtime] = (new Buffer(token, 'base64')).toString().split('|');
    await this.model('project_sign').add({
      user_id, create_time:moment().unix(), ...oth
    })
    return this.success();
  }

  async signListAction(){
    let { token, day } = this.param();
    let [user_id, unixtime] = (new Buffer(token, 'base64')).toString().split('|');
    let where = {user_id};
    if(day){
      let d = moment(day, 'YYYY-MM-DD');
      let t1 = d.unix();
      d.add(1,'d');
      let t2 = d.unix();
      where['create_time'] = ['BETWEEN', [t1, t2]];
    }
    let signList = await this.model('project_sign').where(where).select();
    return this.success(signList);
  }

  async validPasswordAction(){
    let { token, password } = this.param();
    let [user_id, unixtime] = (new Buffer(token, 'base64')).toString().split('|');

    let user = await this.model('user').where({id:user_id,password}).find();
    if(!think.isEmpty(user)){
      return this.success();
    }else{
      return this.fail(630, '密码错误');
    }
  }

  async uploadAction(){
    let { token } = this.param();
    let [user_id, unixtime] = (new Buffer(token, 'base64')).toString().split('|');

    let create_time = moment().unix();

    let attachList = await Promise.all(_.map(this.file(),async o=>{
      let hash = md5File.sync(o.path);
      let content_type = o.headers['content-type'];
      let data = { name:o.originalFilename, hash, create_time,user_id,content_type };
      let id = await this.model('attach').add(data);
      fs.renameSync(o.path, think.RUNTIME_PATH + '/' + hash);
      return {
        ...data,id
      };
    }));
    return this.success(attachList);
  }
}
