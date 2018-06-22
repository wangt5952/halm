'use strict';

import Base from './base.js';
import _ from 'lodash';
import moment from 'moment';
import md5File from 'md5-file';
import fs from 'fs';
import jszip from 'jszip';

import sharp from 'sharp';
import pdfjs from 'pdfjs-dist';
//import Canvas from 'canvas';


moment.locale('zh-cn');
export default class extends Base {

  async __before(){
    let user = await this.session('user');
    if(think.isEmpty(user)) return this.redirect(`/auth/login?ret=${encodeURIComponent(this.http.url)}`);

    this.pageConfig = {
      breadcrumbList:[
        {name:'我的首页', href:'/user'},
        {name:'建设管理', href:'/user/project'},
      ]
    }
    this.user = user;

    this.assign({pageConfig:this.pageConfig});
  }

  async indexAction(){
    let { id } = this.param();
    let project = await this.model('project').where({id}).find();
    this.pageConfig.breadcrumbList.push(
      {name:project.name, href:`/project?id=${id}`}
    );
    this.pageConfig.project = project;

    let archiveList = await this.model('archive')
      .where({project_id:id, hash:null})
      .order(['sort','name'])
      .select();

    archiveList = _.map(archiveList, o=>({
      ...o,
      children: _.filter(archiveList, {parent_id:o.id})
    }))
    archiveList = _.filter(archiveList, o=>!o.parent_id);

    let workflowList = await this.model('v_workflow').where({project_id:id}).select();
    workflowList = _.map(workflowList, o=>({
      ...o,
      create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
    }))

    let companyList = await this.model('v_project_company').where({project_id:id}).select();
    let userList = await this.model('v_project_user').where({project_id:id}).select();

    _.forEach(companyList, o=>{
      o.userList = [
        {role:'法人代表', user_name:o.company_legal_person, user_mobile:o.company_mobile, user_email:o.company_email},
        ..._.filter(userList, p=>{
          let twiceRole = _.filter(companyList, {company_id:o.company_id});
          if(twiceRole.length > 1){
            return p.company_id == o.company_id && (p.role_code && !p.role_code.indexOf(o.role_code))
          }else if(p.company_id){
            return p.company_id == o.company_id
          }else{
            return  p.role_code && !p.role_code.indexOf(o.role_code);
          }

        })
      ]
    });

    let companyGroup = _.groupBy(companyList, o=>{
      if(o.role_code == 'js') return 'js';
      else if(o.role_code == 'kc' || o.role_code == 'sj') return 'sj';
      else if(o.role_code == 'jl') return 'jl';
      else if(o.role_code == 'jc') return 'jc';
      else if(!o.role_code.indexOf('sg')) return 'sg';
      else if(o.role_code == 'cailiao') return 'cailiao';
      else if(o.role_code == 'shebei') return 'shebei';
      else return 'other';
    });

    this.assign({companyGroup,archiveList,workflowList});
    return this.display();
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
          path.push({name:find_item.name, href:`/project/archive?id=${find_item.id}`, info:find_item.info});
          find_id = find_item.parent_id;
        }
      }
      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:project.name, href:`/project?id=${project_id}`},
        {name:'项目管理资料', href:`/project/archive?project_id=${project_id}`}
      );

      if(path.length)
      {
        this.pageConfig.breadcrumbList.push(...path.reverse());
      }
      this.pageConfig.project = project;
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id, project_id } = this.param();
      let { id: user_id } = this.user;

      if(id){
        let item = await this.model('archive').where({id}).find();
        project_id = item.project_id;
      }

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = { project_id,parent_id:id||null };
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let imageFormat = this.config('app').imageFormat;
      let data = await this.model('v_archive')
        .where(where)
        .order(['sort','name'])
        .page(start/length+1, length)
        .countSelect();

      let fids = _.map(_.filter(data.data, o=>!o.hash), 'id');
      let subImageItemList = []
      if(fids.length){
        let subItemList = await this.model('v_archive').where({parent_id:fids,hash:['!=',null]}).select();
        subImageItemList = _.filter(subItemList,o=>~imageFormat.indexOf(o.content_type));
      }


      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data, o=>{
          let imageList = [];
          let isImage = ~imageFormat.indexOf(o.content_type);
          if(isImage) imageList.push(`/project/archive_image?id=${o.id}`);
          else{
            imageList = _.map(_.filter(subImageItemList, q=>q.parent_id==o.id),p=>`/project/archive_image?id=${p.id}`).slice(0,3);
          }
          let canDelete = o.user_id == user_id;

          return {
            ...o,
            type: isImage ? '图片' : o.type,
            imageList, canDelete,
            create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '-'
          }
        })
      });
    }
  }

  async archiveEditAction(){
    if(this.isGet()){

      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();

      if(oper == 'add'){
        //id = await this.model('project_user').add(oth);
      }else if(oper == 'edit'){
        //await this.model('project_user').where({id}).update(oth);
      }else if(oper == 'del'){
        await this.model('archive').where({id}).delete();
      }
      return this.success(id);
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
        { name:project.name, href:`/project?id=${project_id}`},
        { name:'项目管理资料', href:`/project/archive?project_id=${project_id}`},
        { name:id?'编辑目录':'添加目录'}
      )
      this.pageConfig.project = project;

      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();
      let { id: user_id } = this.user;

      if(oper == 'add'){
        oth.create_time = moment().unix();
        id = await this.model('archive').add({
          ...oth, user_id, type:'文件夹'
        });
      }else if(oper == 'edit'){
        await this.model('archive').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async archiveUploadAction(){
    let { id, task_id } = this.param();
    let { id: user_id } = this.user;
    let { project_id } = await this.model('archive').where({id}).find();
    let create_time = moment().unix();
    let type2name = this.config('app').type2name;
    let ids = await Promise.all(_.map(this.file(), async o=>{

      let content_type = o.headers['content-type'];
      let type = type2name[content_type] || content_type;
      let hash = md5File.sync(o.path);

      let ret = await this.model('archive').add({
        name:o.originalFilename, hash, create_time, project_id,
        parent_id:id,user_id,type,content_type
      });

      fs.renameSync(o.path, think.RUNTIME_PATH + '/' + hash);

      return ret;
    }));

    await this.model('task').where({id:task_id}).update({
      status:'完成',finish_time:create_time
    })

    return this.success(ids);
  }

  async archiveImageAction(){
    let { id } = this.param();
    let item = await this.model('archive').where({id}).find();

    let file = item.hash;

    if(item.hash  && item.content_type == 'image/tiff'){
      file = item.hash + '_png';
      if(!fs.existsSync(think.RUNTIME_PATH + '/' + file)){
        await sharp(think.RUNTIME_PATH + '/' + item.hash).png().toFile(think.RUNTIME_PATH + '/' + file);
      }
    }

    // if(item.hash && item.content_type == 'application/pdf'){
    //   let file = item.hash + '_pdf';
    //   let filePath = think.RUNTIME_PATH + '/' + file;
    //   if(!fs.existsSync(filePath)){
    //     let data = new Uint8Array(fs.readFileSync(think.RUNTIME_PATH + '/' + item.hash));
    //     pdfjs.disableWorker = true;
    //     let doc = await pdfjs.getDocument(data);
    //     let page = await doc.getPage(1);
    //     let viewport = page.getViewport(1.0);
    //     let canvas = new Canvas(viewport.width, viewport.height);
    //
    //     let renderContext = {
    //       canvasContext:canvas.getContext('2d'),
    //       viewport
    //     };
    //
    //     await page.render(renderContext);
    //     console.log('1')
    //   }
    // }

    if(item.hash){
      return this.download(think.RUNTIME_PATH + '/' + file, item.content_type, encodeURIComponent(item.name));
    }
  }

  async archiveDownloadAction(){
    let { id } = this.param();
    id = id.split(',');
    let zip = new jszip();
    let zipFilename = '项目资料';

    let addFile = (zipFolder, itemList, parent_id) => {

      _.each(_.filter(itemList, {parent_id}), o=>{

        if(o.hash){
          zipFolder.file(`${o.name}`, fs.createReadStream(think.RUNTIME_PATH + '/' + o.hash));
        }else{
          addFile(zipFolder.folder(o.name), itemList, o.id);
        }
      });
    };
    let item = await this.model('archive').where({id:id[0]}).find();
    if(id.length == 1){
      if(item.hash){
        // 单文件
        return this.download(think.RUNTIME_PATH + '/' + item.hash, item.content_type, encodeURIComponent(item.name));
      }else{
        // 单文件夹
        let itemList = await this.model('archive').where({project_id:item.project_id}).select();

        zipFilename = item.name;
        addFile(zip.folder(zipFilename), itemList, item.id);
      }
    }else{
      // 多文件
      let itemList = await this.model('archive').where({project_id:item.project_id}).select();
      zipFilename = `${item.name}等${id.length}个文件`;
      let zipFolder = zip.folder(zipFilename);
      _.each(_.filter(itemList, o=>~id.indexOf(o.id+'')), o=>{
        if(o.hash){
          zipFolder.file(`${o.name}`, fs.createReadStream(think.RUNTIME_PATH + '/' + o.hash));
        }else{
          addFile(zipFolder.folder(o.name), itemList, o.id);
        }
      })
    }

    this.type('application/zip');
    this.header('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}.zip"`);
    zip.generateNodeStream({type:'nodebuffer'}).pipe(this.http.res);

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
      path.push({name:find_item.name, href:`/project/archive?id=${find_item.id}`});
      find_id = find_item.parent_id;
    }
    let project = await this.model('project').where({id:project_id}).find();
    this.pageConfig.breadcrumbList.push(
      {name:project.name, href:`/project?id=${project_id}`},
      {name:'项目管理资料', href:`/project/archive?project_id=${project_id}`}
    );

    if(path.length)
    {
      this.pageConfig.breadcrumbList.push(...path.reverse());
    }
    this.pageConfig.project = project;
    this.assign({item});
    return this.display();
  }

  async workflowAction(){
    if(!this.isAjax()){
      let { project_id } = this.param();
      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:project.name, href:`/project?id=${project_id}`},
        {name:'项目管理流程'}
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
      let { id: user_id } = this.user;

      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:project.name, href:`/project?id=${project_id}`},
        {name:'项目管理流程', href:`/project/workflow?project_id=${project_id}`},
        {name:id?'编辑流程':'申请流程'}
      )
      this.pageConfig.project = project;
      this.pageConfig.user = await this.session('user');

      if(id){
        let item = await this.model('workflow').where({id}).find();
        this.assign({item});
      }

      let typeList = await this.model('workflow_type').select();
      let userList = await this.model('project_user')
        .field('b.*,a.role as project_role')
        .alias('a')
        .join({table:'user', as:'b', on:['b.id', 'a.user_id']})
        .where({'a.project_id':project_id, 'a.user_id':['!=',user_id]}).select();
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
      let { id: user_id } = this.user;
      let item = await this.model('v_workflow').where({id}).find();
      item.create_time = moment.unix(item.create_time).format('YYYY-MM-DD HH:mm:ss');

      if(item.attach_id){
        item.attachList = await this.model('attach').where({id:_.map(item.attach_id.split(','))}).select();
      }
      let project_id = item.project_id;
      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:project.name, href:`/project?id=${project_id}`},
        {name:'项目管理流程', href:`/project/workflow?project_id=${project_id}`},
        {name:'审批流程'}
      )
      this.pageConfig.project = project;
      this.pageConfig.user = await this.session('user');
      this.pageConfig.workflow = item;

      let userList = await this.model('project_user')
        .field('b.*,a.role as project_role')
        .alias('a')
        .join({table:'user', as:'b', on:['b.id', 'a.user_id']})
        .where({'a.project_id':project_id, 'a.user_id':['!=',user_id]}).select();
      let formTmplList = await this.model('form_tmpl').select();
      let replyList = await this.model('workflow_reply')
        .field('a.*, b.name as user_name')
        .alias('a')
        .join({table:'user', as:'b', on:['b.id', 'a.user_id']})
      .where({workflow_id:id}).select();
      replyList = Promise.all(_.map(replyList, async o=>{

        if(o.attach_id){
          o.attachList = await this.model('attach').where({id:_.map(o.attach_id.split(','))}).select();
        }
        return {
          ...o,
          create_time: moment.unix(o.create_time).format('YYYY-MM-DD HH:mm:ss'),
        }
      }));
      this.assign({userList,formTmplList,replyList});
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
      if(oth.next_user_id){
        wf.current_user_id = oth.next_user_id;
        wf.status = '';
      }
      else{
        wf.current_user_id = null;
        wf.status = oth.status;
      }

      await this.model('workflow').where({id}).update(wf);

      return this.success(ret_id);
    }
  }

  async taskFinishAction(){
    if(this.isGet()){

      let { id } = this.param();
      let item = await this.model('task').where({id}).find();
      item.params = JSON.parse(item.params || '{}');
      item.create_time = moment.unix(item.create_time).format('YYYY-MM-DD HH:mm:ss');
      let project_id = item.project_id;

      let project = await this.model('project').where({id:project_id}).find();
      this.pageConfig.breadcrumbList.push(
        {name:project.name, href:`/project?id=${project_id}`},
        {name:'处理任务'}
      )
      this.pageConfig.project = project;
      this.assign({item});
      return this.display();
    }else{
      let { oper, id, attach_id } = this.param();

      let now = moment().unix();

      let item = await this.model('task').where({id}).find();
      let params = JSON.parse(item.params || '{}');
      let project_id = item.project_id;
      switch(item.finish_type){
        case 'upload-archive': {

          let parent_id = null;
          let pathList = _.compact(params.archive_path.split('/'));
          for(let i = 0; i < pathList.length; i++){
            let name = pathList[i];
            let folder = await this.model('archive').find({project_id,name,parent_id});
            if(think.isEmpty(folder)){
              parent_id = await this.model('archive').add({
                name, type:'文件夹', project_id,
              });
            }else{
              parent_id = folder.id;
            }
          }

          let type2name = this.config('app').type2name;
          let { id: user_id } = this.user;
          await Promise.all(_.map(attach_id.split(','),async o=>{

            let { name, content_type, hash} = await this.model('attach').where({id:o}).find();
            let type = type2name[content_type] || content_type;

            let ret = await this.model('archive').add({
              name, hash, create_time:now, project_id,
              parent_id,user_id,type,content_type
            });

          }))
        } break;
      }

      await this.model('task').where({id}).update({
        status:'完成',finish_time:now
      })

      return this.success(id);
    }
  }

  async signAction(){

    let { project_id, company_id} = this.param();
    let project = await this.model('project').where({id:project_id}).find();

    this.pageConfig.breadcrumbList.push(
      {name:project.name, href:`/project?id=${project_id}`},
      {name:'考勤查询'}
    )
    this.pageConfig.project = project;

    let where = {'a.project_id':project_id};
    if(company_id) where['b.company_id'] = company_id;

    let signList = await this.model('project_sign')
      .field('a.*, b.name as user_name')
      .alias('a')
      .join({table:'user', as:'b', on:['b.id', 'a.user_id']})
      .where(where)
      .select();

    signList = _.map(signList, o=>{
      let unixtime = moment.unix(o.create_time);
      return {
        ...o,
        columnValue: unixtime.format('YYYY-MM'),
        rowValue: o.user_id,
        rowTitle: o.user_name
      }
    });

    let signTable = [];
    if(_.size(signList)){
      let [minCreateTime, maxCreateTime] = [
        _.minBy(signList,'create_time').create_time,
        _.maxBy(signList,'create_time').create_time
      ];

      let columnTitleList=[];
      let st = moment.unix(minCreateTime);
      let et = moment.unix(maxCreateTime).add(1,'M');

      while(st.valueOf() < et.valueOf()){
        columnTitleList.push(st.format('YYYY-MM'));
        st = st.add(1,'M');
      }

      signTable = _.map([signList], o=>{
        let rowList = _.groupBy(o, 'rowValue');

        rowList = _.map(rowList, p=>{
          let columnList = _.groupBy(p, 'columnValue');
          columnList = _.mapValues(columnList, q=>q.length);
          return {
            title:p[0].rowTitle,
            user_id:p[0].user_id,
            columnList
          }
        })

        return {
          rowList,
          columnTitleList
        }
      });
    }



    let companyList = await this.model('v_project_company').where({project_id:project_id}).select();
    let shigongList = _.map(_.filter(companyList, o=>!o.role_code.indexOf('sg')), o=>({name:`【${o.role}】${o.company_name}`, value:o.company_id+''}));
    let jianliList = _.map(_.filter(companyList, o=>!o.role_code.indexOf('jl')), o=>({name:`【${o.role}】${o.company_name}`, value:o.company_id+''}));
    let jiansheList = _.map(_.filter(companyList, o=>!o.role_code.indexOf('js')), o=>({name:`【${o.role}】${o.company_name}`, value:o.company_id+''}));
    companyList = _.map(companyList, o=>({name:`【${o.role}】${o.company_name}`, value:o.company_id+''}))
    let company = _.find(companyList, {value:company_id});

    this.assign({project,signTable,company, companyList, shigongList, jianliList, jiansheList});
    return this.display();
  }

  async signUserAction(){

    let { user_id, project_id, y, m, d } = this.param();
    let project = await this.model('project').where({id:project_id}).find();
    let user = await this.model('user').where({id:user_id}).find();

    this.pageConfig.breadcrumbList.push(
      {name:project.name, href:`/project?id=${project_id}`},
      {name:'考勤查询', href:`/project/sign?project_id=${project_id}`},
      {name:user.name}
    )
    this.pageConfig.project = project;

    let signList = await this.model('project_sign').where({project_id,user_id}).select();
    signList = _.map(signList, o=>{
      let unixtime = moment.unix(o.create_time);
      return {
        ...o,
        y:unixtime.format('Y'),
        m:unixtime.format('M'),
        d:unixtime.format('D'),
        create_time: unixtime.format('HH:mm:ss'),
        attach_id: o.attach_id ? o.attach_id.split(','):[],
        title: unixtime.format('YYYY年MM月DD日')
      }
    });

    signList = _.groupBy(signList, 'title');
    signList = _.map(signList, o=>{
      return {
        y:o[0].y,
        m:o[0].m,
        d:o[0].d,
        title:o[0].title,
        list:o
      }
    })

    signList = _.filter(signList, o=>{

      return (!y || (o.y == y)) && (!m || (o.m == m)) && (!d || (o.d == d))
    });


    this.assign({signList});
    return this.display()
  }

  async signUser2Action(){

    let { user_id, project_id, y, m } = this.param();
    let project = await this.model('project').where({id:project_id}).find();
    let user = await this.model('user').where({id:user_id}).find();

    this.pageConfig.breadcrumbList.push(
      {name:project.name, href:`/project?id=${project_id}`},
      {name:'考勤查询', href:`/project/sign?project_id=${project_id}`},
      {name:user.name}
    )
    this.pageConfig.project = project;

    let where = {project_id, user_id};

    let signList = await this.model('project_sign')
      .where(where)
      .select();

    signList = _.map(signList, o=>{
      let unixtime = moment.unix(o.create_time);
      return {
        ...o,
        day: unixtime.format('D'),
        title: unixtime.format('YYYY年MM月'),
      }
    });

    let signMonthList = _.groupBy(signList, 'user_id');
    signMonthList = _.map(signMonthList, o=>{
      let titleList = _.groupBy(o, 'title');
      titleList = _.map(titleList, p=>{
        let dayList = _.groupBy(p,'day');
        dayList = _.mapValues(dayList, q=>q.length);

        let unixtime = moment.unix(p[0].create_time);

        return {
          title:p[0].title,
          month: unixtime.format('M'),
          year: unixtime.format('YYYY'),
          ...dayList
        }
      });
      let unixtime = moment.unix(o[0].create_time);
      return {
        title:o[0].title,
        max_day: unixtime.daysInMonth(),
        month: unixtime.format('M'),
        year: unixtime.format('YYYY'),
        titleList
      }
    })

    this.assign({project,signMonthList, user});
    return this.display()
  }
}
