'use strict';

import Base from './base.js';
import _ from 'lodash';
import moment from 'moment';
import md5File from 'md5-file';
import fs from 'fs';
import jszip from 'jszip';


moment.locale('zh-cn');
export default class extends Base {

  async __before(){

    let user = await this.session('user');
    if(think.isEmpty(user)) return this.redirect(`/auth/login?ret=${encodeURIComponent(this.http.url)}`);
    let auth = await this.session('auth');
    this.user = user;
    this.auth = auth;
    this.pageConfig = {
      breadcrumbList:[{
        name:'管理首页', href:'/admin'
      }],
      user,auth
    }

    this.assign({pageConfig:this.pageConfig});
  }

  indexAction(){
    //auto render template file index_index.html
    return this.display();
  }

  async userAction(){
    if(!this.isAjax()){
      let { company_id } = this.param();
      if(company_id){
        let company = await this.model('company').where({id:company_id}).find();
        this.pageConfig.breadcrumbList.push(
          {name:'单位管理', href:'/admin/company'},
          {name:company.name},
          {name:'人员管理', href:`/admin/user?company_id=${company.id}`}
        );
        this.pageConfig.company = company;
      }else{
        this.pageConfig.breadcrumbList.push(
          {name:'人员管理', href:'/admin/user'}
        );
      }

      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { company_id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name|username'] = ['like', `%${searchKey}%`];
      if(company_id) where['company_id'] = company_id;

      let data = await this.model('v_user')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async userEditAction(){
    if(this.isGet()){
      let { id, company_id } = this.param();
      let { authTree } = this.config('app');
      authTree = _.cloneDeep(authTree);

      if(company_id){
        let company = await this.model('company').where({id:company_id}).find();
        this.pageConfig.breadcrumbList.push(
          {name:'单位管理', href:'/admin/company'},
          {name:company.name},
          {name:'人员管理', href:`/admin/user?company_id=${company.id}`},
          {name:id?'编辑人员':'添加人员'}
        );
        this.pageConfig.company = company;
      }else{
        this.pageConfig.breadcrumbList.push(
          {name:'人员管理', href:'/admin/user'},
          {name:id?'编辑人员':'添加人员'}
        );
        let companyList = await this.model('company').select();
        this.assign({companyList});
      }

      if(id){
        let item = await this.model('user').where({id}).find();
        item.head_attach_id = item.head_attach_id ? item.head_attach_id.split(',') : [];
        item.cyzs_attach_id = item.cyzs_attach_id ? item.cyzs_attach_id.split(',') : [];

        let eachTree = (root, func) => {
          _.forEach(root, o=>{
            func(o)
            if(o.children && o.children.length) eachTree(o.children, func);
          })
        }

        let authList = item.auth ? item.auth.split(',') : [];
        eachTree(authTree, o=>{
          let a = _.find(authList, p=>p==o.code);
          if(a) o.checked = true;
        })

        this.assign({item});
      }

      let typeList = await this.model('user_type').select();
      let areaList = this.config('app').userAreaList;//await this.model('area').select();
      let projectTypeList = await this.model('project_type').where({parent_id:null}).select();
      this.assign({typeList,areaList,projectTypeList,authTree});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      oth.auth = oth.auth || '';

      if(oth.company_id == '') oth.company_id = null;
      if(oper == 'add'){
        id = await this.model('user').add(oth);
        return this.success(id);
      }else if(oper == 'edit'){
        if(oth.username){
          let user = await this.model('user').where({id:['!=',id],username:oth.username}).find();
          if(!think.isEmpty(user)){
            return this.fail(610,'用户名已存在');
          }
        }

        await this.model('user').where({id}).update(oth);
        return this.success(id);
      }else if(oper == 'del'){
        await this.model('user').where({id}).delete();
        return this.success(id);
      }

    }
  }

  async userTypeAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'人员管理', href:'/admin/user'
      }, {
        name:'人员类型', href:'/admin/user_type'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data = await this.model('user_type')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async userTypeEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'人员管理', href:'/admin/user'
      }, {
        name:'类别管理', href:'/admin/user_type'
      }, {
        name:id?'编辑类别':'添加类别'
      });
      if(id){
        let item = await this.model('user_type').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        id = await this.model('user_type').add(oth);
      }else if(oper == 'edit'){
        await this.model('user_type').where({id}).update(oth);
      }else if(oper == 'del'){
        await this.model('user_type').where({id}).delete();
      }
      return this.success(id);
    }
  }

  async companyAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'单位管理', href:'/admin/company'
      });
      let typeList = await this.config('app').companyTypeList;
      this.assign({typeList});
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let { type } = this.param();

      if(type){
        let typeList = await this.config('app').companyTypeList;
        let t = _.find(typeList, {value:type});
        if(t) where['type'] = t.name;

      }

      let data = await this.model('company')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async companyEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'单位管理', href:'/admin/company'
      }, {
        name:id?'编辑单位':'添加单位'
      });
      if(id){
        let { attach_id, ...item} = await this.model('company').where({id}).find();
        item = {
          ...item,
          ..._.mapKeys(_.mapValues(JSON.parse(attach_id||'{}'),o=>o.split(',')), (o,k)=>(k+'_attach_id'))
        }
        this.assign({item});
      }

      let areaList = this.config('app').userAreaList;//await this.model('area').where({level:3}).select();
      this.assign({areaList})
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add' || oper == 'edit'){
        if(oth.name){
          let chk = await this.model('company').where({id:['!=',id],name:oth.name}).find();
          if(!think.isEmpty(chk)){
            return this.fail(621,'单位名称已存在');
          }
        }else{
          return this.fail(622,'单位名称不能为空');
        }

        let attachList = _.map(_.pickBy(oth, (o,k)=>_.endsWith(k,'attach_id')), (o,k)=>{
          let code = _.replace(k, /_attach_id$/,'');
          return { attach_id:o, code };
        });
        attachList = _.mapValues(_.groupBy(attachList, 'code'), o=>_.map(o,'attach_id').join(','))
        oth.attach_id = JSON.stringify(attachList);

        if(oper == 'add'){
          id = await this.model('company').add(oth);
        }else if(oper == 'edit'){
          await this.model('company').where({id}).update(oth);
        }
        return this.success(id);
      }else if(oper == 'del'){
        await this.model('company').where({id}).delete();
        return this.success(id);
      }
    }
  }

  async areaAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'区域管理', href:'/admin/area'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let data = await this.model('v_area')
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async areaEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'区域管理', href:'/admin/area'
      }, {
        name:id?'编辑区域':'添加区域'
      });
      if(id){
        let item = await this.model('area').where({id}).find();
        this.assign({item});
      }

      let areaList = await this.model('area').where({level:['<',3]}).select();
      this.assign({areaList})
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        id = await this.model('area').add(oth);
      }else if(oper == 'edit'){
        await this.model('area').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async projectAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'项目管理', href:'/admin/project'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let areaList = this.config('app').projectAreaList;//await this.model('area').select();

      let data = await this.model('v_project')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data, o=>({
          ...o,
          area_name: _.map(_.intersectionWith(areaList, o.area_id ? o.area_id.split(',') : [], (p1,p2)=>{
            return _.toString(p1.id) == p2;
          }),'name').join(','),
          kg_time: o.kg_time ? moment.unix(o.kg_time).format('YYYY-MM-DD') : '',
          jhwc_time: o.jhwc_time ? moment.unix(o.jhwc_time).format('YYYY-MM-DD') : '',
          wgys_time: o.wgys_time ? moment.unix(o.wgys_time).format('YYYY-MM-DD') : '',
          jgys_time: o.jgys_time ? moment.unix(o.jgys_time).format('YYYY-MM-DD') : '',
        }))
      });
    }
  }

  async projectEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'项目管理', href:'/admin/project'
      }, {
        name:id?'编辑项目':'添加项目'
      });

      let typeList = await this.model('project_type').select();
      let companyList = await this.model('company').select();
      let userList = await this.model('user').where({company_id:['!=',null]}).select();
      let areaList = this.config('app').projectAreaList;//await this.model('area').select();

      if(id){
        let item = await this.model('project').where({id}).find();
        let { area_id } = item;

        area_id = area_id ? area_id.split(',') : [];

        areaList = _.map(areaList, o=>({
          ...o,
          selected_area_id: ~area_id.indexOf(_.toString(o.id))
        }));

        item.kg_time = item.kg_time ? moment.unix(item.kg_time).format('YYYY-MM-DD') : '';
        item.jhwc_time = item.jhwc_time ? moment.unix(item.jhwc_time).format('YYYY-MM-DD') : '';
        item.wgys_time = item.wgys_time ? moment.unix(item.wgys_time).format('YYYY-MM-DD') : '';
        item.jgys_time = item.jgys_time ? moment.unix(item.jgys_time).format('YYYY-MM-DD') : '';

        let pcList = await this.model('project_company').where({project_id:id, role_code:['!=',null]}).select();
        let puList = await this.model('project_user').where({project_id:id, role_code:['!=',null]}).select();
        item = {
          ...item,
          ..._.mapValues(_.mapKeys(pcList, o=>o.role_code+'_company_id'), 'company_id'),
          ..._.mapValues(_.mapKeys(puList, o=>o.role_code+'_user_id'), 'user_id')
        }

        this.assign({item});
      }

      let archiveTemplateList = this.config('app').archiveTemplate;
      this.assign({typeList, companyList, userList, areaList,archiveTemplateList});
      return this.display();
    }else{
      let { oper, id, archive_template, archive_template_confirm,  ...oth } = this.param();
      let { id:user_id } = await this.session('user');

      oth.kg_time = oth.kg_time ? moment(oth.kg_time, 'YYYY-MM-DD').unix() : 0;
      oth.jhwc_time = oth.jhwc_time ? moment(oth.jhwc_time, 'YYYY-MM-DD').unix() : 0;
      oth.wgys_time = oth.wgys_time ? moment(oth.wgys_time, 'YYYY-MM-DD').unix() : 0;
      oth.jgys_time = oth.jgys_time ? moment(oth.jgys_time, 'YYYY-MM-DD').unix() : 0;

      if(oper == 'add'){
        id = await this.model('project').add(oth);

        let { puRoleList, pcRoleList } = this.config('app');

        let pcList = _.map(_.pickBy(oth, (o,k)=>_.endsWith(k,'company_id')), (o,k)=>{
          let role_code = _.replace(k, /_company_id$/,'');
          let role = role_code;
          let r = _.find(pcRoleList, {code:role});
          if(r) role = r.name;
          return { project_id:id, company_id:o, role, role_code };
        });

        let puList = _.map(_.pickBy(oth, (o,k)=>_.endsWith(k,'user_id')), (o,k)=>{
          let role_code = _.replace(k, /_user_id$/,'');
          let role = role_code;
          let r = _.find(puRoleList, {code:role});
          if(r) role = r.name;
          return { project_id:id, user_id:o, role, role_code };
        });

        pcList = _.filter(pcList, 'company_id');
        //puList = _.filter(puList, 'user_id');

        if(pcList.length){
          await this.model('project_company').addMany(pcList);
        }

        if(puList.length){
          await this.model('project_user').addMany(puList);
        }
      }else if(oper == 'edit'){
        await this.model('project').where({id}).update(oth);

        let pcList = _.map(_.pickBy(oth, (o,k)=>_.endsWith(k,'company_id')), (o,k)=>{
          let role_code = _.replace(k, /_company_id$/,'');
          return { project_id:id, company_id:o, role:role_code, role_code };
        });

        let { puRoleList } = this.config('app');

        let puList = _.map(_.pickBy(oth, (o,k)=>_.endsWith(k,'user_id')), (o,k)=>{
          let role_code = _.replace(k, /_user_id$/,'');
          let role = role_code;
          let r = _.find(puRoleList, {code:role});
          if(r) role = r.name;
          return { project_id:id, user_id:o, role, role_code };
        });

        await Promise.all(_.map(pcList, async o=>{
          if(o.company_id){
            let effect = await this.model('project_company').where({role_code:o.role_code, project_id:o.project_id}).update({company_id:o.company_id});
            if(!effect){
              await this.model('project_company').add(o);
            }
          }else{
            await this.model('project_company').where({role_code:o.role_code, project_id:o.project_id}).delete();
          }
        }));

        await Promise.all(_.map(puList, async o=>{
          // if(o.user_id){
            let effect = await this.model('project_user').where({role_code:o.role_code, project_id:o.project_id}).update({user_id:o.user_id,role:o.role});
            if(!effect){
              await this.model('project_user').add(o);
            }
          // }else{
          //   await this.model('project_user').where({role_code:o.role_code, project_id:o.project_id}).delete();
          // }
        }));
      }

      if((oper == 'add' || oper == 'edit') && archive_template && archive_template_confirm){
        let archiveTemplateList = this.config('app').archiveTemplate;
        let archiveTemplate = _.find(archiveTemplateList, {name:archive_template});
        if(archiveTemplate){
          await this.model('archive').where({project_id:id}).delete();
          await this.model('archive').addTree({project_id:id,type:'文件夹',user_id}, archiveTemplate.archive);
        }
      }else if(oper == 'del'){
        await this.model('project').where({id}).delete();
      }
      return this.success(id);
    }
  }

  async projectTypeAction(){
    if(!this.isAjax()){
      let { id } = this.param();

      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        {name:'类别管理', href:'/admin/project_type'}
      );

      if(id){
        let typeList = await this.model('project_type').select();
        let typePath = [];
        let next_id = id;
        while(next_id){
          let type = _.find(typeList, o=>o.id==next_id);
          if(type){
            typePath.push(type);
            next_id = type.parent_id;
          }else{
            next_id = null;
          }
        }
        typePath = _.reverse(typePath);
        this.pageConfig.breadcrumbList.push(..._.map(typePath, o=>({
          name:o.name, href:`/admin/project_type?id=${o.id}`
        })))
      }

      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      if(id){
        where['parent_id'] = id;
      }else{
        where['parent_id'] = null;
      }

      let data = await this.model('project_type')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async projectTypeEditAction(){
    if(this.isGet()){
      let { id, parent_id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'项目管理', href:'/admin/project'
      }, {
        name:'类别管理', href:'/admin/project_type'
      }, {
        name:id?'编辑栏目':'添加栏目'
      });
      if(id){
        let item = await this.model('project_type').where({id}).find();
        parent_id = item.parent_id;
        this.assign({item});
      }

      if(parent_id){
        let parent = await this.model('project_type').where({id:parent_id}).find();
        this.assign({parent});
      }
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add' || oper == 'edit'){
        oth.parent_id = oth.parent_id || null;
      }

      if(oper == 'add'){
        id = await this.model('project_type').add(oth);
      }else if(oper == 'edit'){
        await this.model('project_type').where({id}).update(oth);
      }else if(oper == 'del'){
        await this.model('project_type').where({id}).delete();
      }
      return this.success(id);
    }
  }

  async workflowAction(){
    if(!this.isAjax()){
      let { project_id } = this.param();
      let project;
      if(project_id){
        project = await this.model('project').where({id:project_id}).find();
        this.pageConfig.breadcrumbList.push(
          {name:'项目管理', href:'/admin/project'},
          {name: project ? project.name : '全部项目'},
          {name:'项目管理流程'}
        )
        this.pageConfig.project = project;
      }else{
        this.pageConfig.breadcrumbList.push(
          {name:'项目管理流程'}
        )
      }


      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { project_id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['project_name'] = ['like', `%${searchKey}%`];
      if(project_id) where['project_id'] = project_id;

      let data = await this.model('v_workflow')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data,o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
          update_time: o.update_time ? moment.unix(o.update_time).fromNow() : ''
        }))
      });
    }
  }

  async workflowEditAction(){
    if(this.isGet()){
      let { id, project_id } = this.param();

      if(project_id){
        let project = await this.model('project').where({id:project_id}).find();
        this.pageConfig.breadcrumbList.push(
          {name:'项目管理', href:'/admin/project'},
          { name:project.name},
          { name:'流程管理', href:`/admin/workflow?project_id=${project_id}`},
          { name:id?'编辑流程':'添加流程'}
        )
        this.pageConfig.project = project;
      }else{
        this.pageConfig.breadcrumbList.push({
          name:'流程管理', href:'/admin/workflow'
        }, {
          name:id?'编辑流程':'添加流程'
        });
        let projectList = await this.model('project').select();
        this.assign({projectList});
      }

      if(id){
        let item = await this.model('workflow').where({id}).find();
        this.assign({item});
      }


      let typeList = await this.model('workflow_type').select();
      let userList = await this.model('user').select();
      let formTmplList = await this.model('form_tmpl').select();
      this.assign({typeList,userList,formTmplList});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        oth.current_user_id = oth.next_user_id;
        oth.create_time = moment().unix();
        id = await this.model('workflow').add(oth);
      }else if(oper == 'edit'){
        await this.model('workflow').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async workflowReplyAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'流程管理', href:'/admin/workflow'
      }, {
        name:'审批流程'
      });
      if(id){
        let main = await this.model('v_workflow').where({id}).find();
        this.assign({main});
      }

      let projectList = await this.model('project').select();
      let typeList = await this.model('workflow_type').select();
      let userList = await this.model('user').select();
      let formTmplList = await this.model('form_tmpl').select();
      this.assign({projectList,typeList,userList,formTmplList});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      let now = moment().unix();
      let ret_id = await this.model('workflow_reply').add({
        ...oth,
        workflow_id: id,
        create_time: now
      });

      let wf = {update_time:now};
      if(oth.next_user_id) wf.current_user_id = oth.next_user_id;
      else wf.status = oth.status;

      await this.model('workflow').where({id}).update(wf);

      return this.success(ret_id);
    }
  }

  async workflowTypeAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'流程管理', href:'/admin/workflow'
      }, {
        name:'类别管理', href:'/admin/workflow_type'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data = await this.model('workflow_type')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async workflowTypeEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'流程管理', href:'/admin/workflow'
      }, {
        name:'类别管理', href:'/admin/workflow_type'
      }, {
        name:id?'编辑类别':'添加类别'
      });
      if(id){
        let item = await this.model('workflow_type').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        id = await this.model('workflow_type').add(oth);
      }else if(oper == 'edit'){
        await this.model('workflow_type').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async projectFundsAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'资金管理', href:'/admin/project_funds'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['project_name'] = ['like', `%${searchKey}%`];

      let data = await this.model('v_project_funds')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async projectFundsEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'资金管理', href:'/admin/project_funds'
      }, {
        name:id?'编辑资金':'添加资金'
      });
      if(id){
        let { content, ...item } = await this.model('project_funds').where({id}).find();
        if(content){
          item = {
            ...item,
            ...JSON.parse(content)
          }
        }
        this.assign({item});
      }

      let projectList = await this.model('project').select();
      this.assign({projectList});
      return this.display();
    }else{
      let { oper, id, project_id, company_id, jsonContent, ...oth } = this.param();

      oth = {
        project_id,
        company_id,
        content: JSON.stringify({
          ...oth,
          ...JSON.parse(jsonContent)
        })
      }

      if(oper == 'add'){
        id = await this.model('project_funds').add(oth);
      }else if(oper == 'edit'){
        await this.model('project_funds').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async projectEvalAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'考评管理', href:'/admin/project_eval'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['project_name|company_name'] = ['like', `%${searchKey}%`];

      let data = await this.model('v_project_eval')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async projectEvalEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'考评管理', href:'/admin/project_eval'
      }, {
        name:id?'编辑考评':'添加考评'
      });
      if(id){
        let { content, ...item } = await this.model('project_eval').where({id}).find();
        if(content){
          item = {
            ...item,
            ...JSON.parse(content)
          }
        }
        this.assign({item});
      }

      let projectList = await this.model('project').select();
      let companyList = await this.model('company').select();
      this.assign({projectList,companyList});
      return this.display();
    }else{
      let { oper, id, project_id, company_id, ...oth } = this.param();

      oth = {
        project_id,
        company_id,
        content: JSON.stringify(oth)
      }

      if(oper == 'add'){
        id = await this.model('project_eval').add(oth);
      }else if(oper == 'edit'){
        await this.model('project_eval').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async articleAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'文章栏目', href:'/admin/article'
      });

      let { type_id } = this.param();

      let typeList = await this.model('article_type').select();
      this.assign({typeList});

      if(type_id){
        let typePath = [];
        let next_type_id = type_id;
        while(next_type_id){
          let type = _.find(typeList, o=>o.id==next_type_id);
          if(type){
            typePath.push(type);
            next_type_id = type.parent_id;
          }else{
            next_type_id = null;
          }
        }

        typePath = _.reverse(typePath);
        this.assign({typePath});

        this.pageConfig.breadcrumbList.push(..._.map(typePath,o=>({
          name:o.name, href:`/admin/article?type_id=${o.id}`
        })));
      }


      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { type_id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      if(type_id) where['type_id'] = type_id;

      let data = await this.model('v_article')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data, o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).format('YYYY-MM-DD HH:mm:ss') : '-'
        }))
      });
    }
  }

  async articleEditAction(){
    if(this.isGet()){
      let { id, type_id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'文章栏目', href:'/admin/article'
      }, {
        name:id?'编辑文章':'添加文章'
      });

      if(type_id){
        let type = await this.model('article_type').where({id:type_id}).find();
        this.pageConfig.type = type;
      }else{
        let typeList = await this.model('article_type').select();
        this.assign({typeList});
      }

      if(id){
        let { attach_id, ...item} = await this.model('article').where({id}).find();
        if(attach_id){
          let attachList = await this.model('attach').where({id:attach_id.split(',')}).select();
          this.assign({attachList});
        }
        this.assign({item});
      }

      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        oth.create_time = moment().unix();
        id = await this.model('article').add(oth);
      }else if(oper == 'edit'){
        await this.model('article').where({id}).update(oth);
      }else if(oper == 'del'){
        await this.model('article').where({id}).delete();
      }
      return this.success(id);
    }
  }

  async articleTypeAction(){
    if(!this.isAjax()){
      let { id } = this.param();

      this.pageConfig.breadcrumbList.push(
        {name:'文章栏目', href:'/admin/article'},
        {name:'栏目管理', href:'/admin/article_type'}
      );

      if(id){
        let typeList = await this.model('article_type').select();
        let typePath = [];
        let next_id = id;
        while(next_id){
          let type = _.find(typeList, o=>o.id==next_id);
          if(type){
            typePath.push(type);
            next_id = type.parent_id;
          }else{
            next_id = null;
          }
        }
        typePath = _.reverse(typePath);
        this.pageConfig.breadcrumbList.push(..._.map(typePath, o=>({
          name:o.name, href:`/admin/article_type?id=${o.id}`
        })))
      }

      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      if(id){
        where['parent_id'] = id;
      }else{
        where['parent_id'] = null;
      }

      let data = await this.model('article_type')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async articleTypeEditAction(){
    if(this.isGet()){
      let { id, parent_id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'文章栏目', href:'/admin/article'
      }, {
        name:'栏目管理', href:'/admin/article_type'
      }, {
        name:id?'编辑栏目':'添加栏目'
      });
      if(id){
        let item = await this.model('article_type').where({id}).find();
        parent_id = item.parent_id;
        this.assign({item});
      }

      if(parent_id){
        let parent = await this.model('article_type').where({id:parent_id}).find();
        this.assign({parent});
      }
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        id = await this.model('article_type').add(oth);
      }else if(oper == 'edit'){
        await this.model('article_type').where({id}).update(oth);
      }else if(oper == 'del'){
        await this.model('article_type').where({id}).delete();
      }
      return this.success(id);
    }
  }

  async formTmplAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'表式模版', href:'/admin/form_tmpl'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data = await this.model('form_tmpl')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data, o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).format('YYYY-MM-DD HH:mm:ss') : '-'
        }))
      });
    }
  }

  async formTmplEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'表式模版', href:'/admin/form_tmpl'
      }, {
        name:id?'编辑模版':'添加模版'
      });
      if(id){
        let item = await this.model('form_tmpl').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        oth.create_time = moment().unix();
        id = await this.model('form_tmpl').add(oth);
      }else if(oper == 'edit'){
        await this.model('form_tmpl').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async archiveAction(){

    if(!this.isAjax()){
      let { id, project_id } = this.param();
      let path = [];
      if(id){
        let item = await this.model('archive').where({id}).find();
        project_id = item.project_id;
        let archiveList = await this.model('archive').where({project_id,hash:null}).select();
        let find_id = id;
        while(find_id){
          let find_item = _.find(archiveList, o=>o.id==find_id);
          path.push({name:find_item.name, href:`/admin/archive?id=${find_item.id}`});
          find_id = find_item.parent_id;
        }
      }
      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        {name:project.name},
        {name:'项目管理资料', href:`/admin/archive?project_id=${project_id}`}
      )

      if(path.length)
      {
        this.pageConfig.breadcrumbList.push(...path.reverse());
      }
      this.pageConfig.project = project;
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id, project_id } = this.param();

      if(id){
        let item = await this.model('archive').where({id}).find();
        project_id = item.project_id;
      }

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = { project_id,parent_id:id||null };
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data = await this.model('v_archive')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data, o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '-'
        }))
      });
    }
  }

  async archiveFolderAction(){
    if(this.isGet()){
      let { parent_id, project_id, id } = this.param();

      if(parent_id){
        let parent = await this.model('archive').where({id:parent_id}).find();
        project_id = parent.project_id;
      }else if(id){
        let item = await this.model('archive').where({id}).find();
        project_id = item.project_id;
        this.assign({item});
      }

      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        { name:project.name},
        { name:'项目管理资料', href:`/admin/archive?project_id=${project_id}`},
        { name:id?'编辑目录':'添加目录'}
      )
      this.pageConfig.project = project;

      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();
      let { id: user_id } = await this.session('user');

      if(oper == 'add'){
        oth.create_time = moment().unix();
        id = await this.model('archive').add({
          ...oth, user_id
        });
      }else if(oper == 'edit'){
        await this.model('archive').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async archiveUploadAction(){
    let { id } = this.param();
    let { id: user_id } = await this.session('user');
    let { project_id } = await this.model('archive').where({id}).find();
    let create_time = moment().unix();
    let ids = await Promise.all(_.map(this.file(), async o=>{

      let type = o.headers['content-type'];
      let hash = md5File.sync(o.path);

      let ret = await this.model('archive').add({
        name:o.originalFilename, hash, create_time, project_id,
        parent_id:id,user_id,type
      });

      fs.renameSync(o.path, think.RUNTIME_PATH + '/' + hash);

      return ret;
    }));

    return this.success(ids);
  }

  async archiveDownloadAction(){
    let { id } = this.param();

    let item = await this.model('archive').where({id}).find();
    if(item.hash){
      return this.download(think.RUNTIME_PATH + '/' + item.hash, item.type, encodeURIComponent(item.name));
    }else{
      let zip = new jszip();

      let itemList = await this.model('archive').where({project_id:item.project_id}).select();

      let addFile = (zipFolder, itemList, parent_id) => {

        _.each(_.filter(itemList, {parent_id}), o=>{

          if(o.hash){
            zipFolder.file(`${o.name}`, fs.createReadStream(think.RUNTIME_PATH + '/' + o.hash));
          }else{
            addFile(zipFolder.folder(o.name), itemList, o.id);
          }
        });
      };

      addFile(zip.folder(item.name), itemList, item.id);

      this.type('application/zip');
      this.header('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name)}.zip"`);
      zip.generateNodeStream({type:'nodebuffer'}).pipe(this.http.res);
    }
  }

  async archiveViewAction(){
    let { id } = this.param();
    let path = [];
    let item = await this.model('archive').where({id}).find();
    let project_id = item.project_id;
    let archiveList = await this.model('archive').where({project_id,hash:null}).select();
    let find_id = item.parent_id;
    path.push({name:item.name})
    while(find_id){
      let find_item = _.find(archiveList, o=>o.id==find_id);
      path.push({name:find_item.name, href:`/admin/archive?id=${find_item.id}`});
      find_id = find_item.parent_id;
    }
    let project = await this.model('project').where({id:project_id}).find();
    this.pageConfig.breadcrumbList.push({
      name:'项目管理', href:'/admin/project',
    },{
      name:project.name
    },{
      name:'项目管理资料', href:`/admin/archive?project_id=${project_id}`
    })

    if(path.length)
    {
      this.pageConfig.breadcrumbList.push(...path.reverse());
    }
    this.pageConfig.project = project;
    this.assign({item});
    return this.display();
  }

  async projectCompanyAction(){
    if(!this.isAjax()){
      let { project_id } = this.param();
      let project;
      project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        {name: project ? project.name : '全部项目'},
        {name:'参建单位'}
      )
      this.pageConfig.project = project;
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { project_id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      //if(searchKey) where['project_name'] = ['like', `%${searchKey}%`];
      if(project_id) where['project_id'] = project_id;

      let data = await this.model('v_project_company')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data,o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
          update_time: o.update_time ? moment.unix(o.update_time).fromNow() : ''
        }))
      });
    }
  }

  async projectCompanyEditAction(){
    if(this.isGet()){
      let { id, project_id } = this.param();

      if(id){
        let item = await this.model('project_company').where({id}).find();
        project_id = item.project_id;
        this.assign({item});
      }

      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        { name:project.name},
        { name:'参建单位', href:`/admin/project_company?project_id=${project_id}`},
        { name:id?'编辑参建单位':'添加参建单位'}
      )
      this.pageConfig.project = project;

      let companyList = await this.model('company').select();
      this.assign({companyList});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        id = await this.model('project_company').add(oth);
      }else if(oper == 'edit'){
        await this.model('project_company').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async projectUserAction(){
    if(!this.isAjax()){
      let { project_id } = this.param();
      let project;
      project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        {name: project.name},
        {name:'参建人员'}
      )
      this.pageConfig.project = project;
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { project_id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      //if(searchKey) where['project_name'] = ['like', `%${searchKey}%`];
      if(project_id) where['project_id'] = project_id;

      let data = await this.model('v_project_user')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data,o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
          update_time: o.update_time ? moment.unix(o.update_time).fromNow() : ''
        }))
      });
    }
  }

  async projectUserEditAction(){
    if(this.isGet()){
      let { id, project_id } = this.param();

      if(id){
        let item = await this.model('project_user').where({id}).find();
        project_id = item.project_id;
        this.assign({item});
      }

      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:'项目管理', href:'/admin/project'},
        { name:project.name},
        { name:'参建人员', href:`/admin/project_user?project_id=${project_id}`},
        { name:id?'编辑参建人员':'添加参建人员'}
      )
      this.pageConfig.project = project;

      let userList = await this.model('user').select();
      this.assign({userList});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        id = await this.model('project_user').add(oth);
      }else if(oper == 'edit'){
        await this.model('project_user').where({id}).update(oth);
      }else if(oper == 'del'){
        await this.model('project_user').where({id}).delete();
      }
      return this.success(id);
    }
  }


  async taskAction(){
    if(!this.isAjax()){
      let { project_id } = this.param();
      let project;
      if(project_id){
        project = await this.model('project').where({id:project_id}).find();
        this.pageConfig.breadcrumbList.push(
          {name:'项目管理', href:'/admin/project'},
          {name: project ? project.name : '全部项目'},
          {name:'项目任务'}
        )
        this.pageConfig.project = project;
      }else{
        this.pageConfig.breadcrumbList.push(
          {name:'项目任务'}
        )
      }

      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { project_id } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      if(project_id) where['project_id'] = project_id;

      let data = await this.model('v_task')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data,o=>({
          ...o,
          create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
          finish_time: o.finish_time ? moment.unix(o.finish_time).fromNow() : ''
        }))
      });
    }
  }

  async taskEditAction(){
    if(this.isGet()){
      let { id, project_id } = this.param();

      if(id){
        let item = await this.model('task').where({id}).find();
        project_id = item.project_id;
        item.params = JSON.parse(item.params || '{}');
        this.assign({item});
      }

      if(project_id){
        let project = await this.model('project').where({id:project_id}).find();
        this.pageConfig.breadcrumbList.push(
          {name:'项目管理', href:'/admin/project'},
          { name:project.name},
          { name:'任务管理', href:`/admin/task?project_id=${project_id}`},
          { name:id?'编辑任务':'添加任务'}
        )
        this.pageConfig.project = project;
      }else{
        this.pageConfig.breadcrumbList.push({
          name:'流程任务', href:'/admin/task'
        }, {
          name:id?'编辑任务':'添加任务'
        });
        let projectList = await this.model('project').select();
        this.assign({projectList});
      }



      let workflowTypeList = await this.model('workflow_type').select();
      let userList = await this.model('project_user')
        .field('b.*')
        .alias('a')
        .join({table:'user', as:'b', on:['b.id', 'a.user_id']})
        .where({'a.project_id':project_id}).select();
      this.assign({workflowTypeList,userList});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        oth.create_time = moment().unix();
        id = await this.model('task').add(oth);
        if(!oth.href){
          await this.model('task').where({id}).update({
            href: `/project/archive?project_id=${oth.project_id}&task_id=${id}`
          });
        }
      }else if(oper == 'edit'){
        await this.model('task').where({id}).update(oth);
      }

      return this.success(id);
    }
  }

  async taskTypeAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'任务管理', href:'/admin/task'
      }, {
        name:'类型管理', href:'/admin/task_type'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data = await this.model('task_type')
        .where(where)
        .order(order)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: data.data
      });
    }
  }

  async taskTypeEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'任务管理', href:'/admin/task'
      }, {
        name:'类型管理', href:'/admin/task_type'
      }, {
        name:id?'编辑类型':'添加类型'
      });
      if(id){
        let item = await this.model('task_type').where({id}).find();
        item.params = JSON.parse(item.params || '{}');
        this.assign({item});
      }

      let workflowTypeList = await this.model('workflow_type').select();
      this.assign({workflowTypeList})
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      oth.start_time = oth.start_time ? moment(oth.start_time, 'YYYY-MM-DD').unix() : 0;
      oth.end_time = oth.end_time ? moment(oth.end_time, 'YYYY-MM-DD').unix() : 0;
      if(oper == 'add'){
        id = await this.model('task_type').add(oth);
      }else if(oper == 'edit'){
        await this.model('task_type').where({id}).update(oth);
      }
      return this.success(id);
    }
  }
}
