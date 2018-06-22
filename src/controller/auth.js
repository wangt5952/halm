'use strict';

import Base from './base.js';
import _ from 'lodash';

export default class extends Base {
  async loginAction(){
    if(this.isGet()){
      return this.display();
    }else{
      let { account,hid, password, ret } = this.param();
      let user;
      if(hid){
           user = await this.model('user').where({hid, password}).find();
      }else{
         user = await this.model('user').where({'username|mobile|idno':account, password}).find();
      }
      if(!think.isEmpty(user)){
        let auth = {};
        _.forEach((user.auth ? user.auth.split(',') : []), o=>{
          auth[o] = true;
        })

        await this.session('user', {
          ...user
        });
        await this.session('auth', auth);
        return this.success({
          redirect: ret || user.login_redirect || '/user'
        })
      }
      else return this.fail(1,'错误的用户名或密码');
    }

  }

  async logoutAction(){
    await this.session();
    return this.redirect('/auth/login');
  }
}
