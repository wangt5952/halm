'use strict';

import Base from './base.js';

import _ from 'lodash';
import moment from 'moment';
import md5File from 'md5-file';
import fs from 'fs';
import ExcelJS from 'exceljs';

moment.locale('zh-cn');

let setProps = (props, objs) => {
  _.each(objs, obj=>{
    _.each(props, (val, key) =>{
      obj[key] = val;
    })
  })
};

let drawBorder = (sheet) => {
  setProps({
    border:{left:{style:'medium'},right:{style:'medium'},top:{style:'medium'}}
  },[sheet.getCell(1,1)]);
  sheet.getColumn(1).eachCell({ includeEmpty: true },(cell,index)=>{
    if(index != 1){
      setProps({
        border:{left:{style:'medium'}}
      },[cell]);
    }
  });
  sheet.getColumn(sheet.columnCount).eachCell({ includeEmpty: true },(cell,index)=>{
    if(index != 1){
      setProps({
        border:{right:{style:'medium'}}
      },[cell]);
    }
  });
  sheet.getRow(sheet.rowCount).eachCell({ includeEmpty: true },(cell,index)=>{
    if(index == 1){
      setProps({
        border:{bottom:{style:'medium'},left:{style:'medium'}}
      },[cell]);
    }else if(index == sheet.columnCount){
      setProps({
        border:{bottom:{style:'medium'},right:{style:'medium'}}
      },[cell]);
    }else{
      setProps({
        border:{bottom:{style:'medium'}}
      },[cell]);
    }
  });
}

export default class extends Base {

  async __before(){
    let user = await this.session('user');
    if(think.isEmpty(user)) return this.redirect(`/auth/login?ret=${encodeURIComponent(this.http.url)}`);
    let auth = await this.session('auth');
    this.user = user;
    this.auth = auth;
    this.pageConfig = {
      breadcrumbList:[{
        name:'我的首页', href:'/user'
      }],
      user,auth
    }

    this.assign({pageConfig:this.pageConfig});
  }
  async indexAction(){
    let { id:user_id } = this.user;
    // let articleList = await this.model('v_article').order({'create_time':'desc'}).select();
    // articleList = _.map(articleList, o=>({
    //   ...o,
    //   create_time: o.create_time ? moment.unix(o.create_time).format('YYYY-MM-DD') : '-'
    // }))
    // articleList = _.groupBy(articleList, 'type_name');
    let articleTypeList = await this.model('article_type').where({parent_id:null}).select();



    articleTypeList = await Promise.all(_.map(articleTypeList, async o=>{

      let subTypeList = await this.model('article_type').where({parent_id:o.id}).select();
      let articleList = [];
      if(_.size(subTypeList) == 0){
        articleList = await this.model('v_article').where({type_id:o.id}).page(0,10).select();
      }else{
        subTypeList = await Promise.all(_.map(subTypeList, async p=>{
          let articleList = await this.model('v_article').where({type_id:p.id}).page(0,10).select();
          return {
            ...p,
            articleList
          }
        }))
      }
      return {
        ...o,
        articleList,
        subTypeList
      }
    }));

    let projectList = await this.model('v_user_project').where({user_id}).select();
    let projectGroup = _.groupBy(projectList, 'status');

    let workflowList = await this.model('v_workflow').where({user_id:user_id}).select();
    workflowList = _.map(workflowList, o=>({
      ...o,
      create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
    }));

    let workflowList_0 = await this.model('v_workflow').where({current_user_id:user_id}).select();
    workflowList_0 = _.map(workflowList_0, o=>({
      ...o,
      create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
    }));

    let workflowList_1 = await this.model('workflow_reply')
      .field('b.*, a.create_time as reply_time, a.status as reply_status')
      .alias('a')
      .join({table:'v_workflow', as:'b', on:['b.id', 'a.workflow_id']})
      .where({'b.user_id':user_id})
      .select();
    workflowList_1 = _.map(workflowList_1, o=>({
      ...o,
      create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
      reply_time: o.reply_time ? moment.unix(o.reply_time).fromNow() : '',
    }));

    let taskList_1 = await this.model('v_task').where({
      user_id,status:null
    }).select();
    taskList_1 = _.map(taskList_1, o=>({
      ...o,
      create_time: o.create_time ? moment.unix(o.create_time).fromNow() : '',
      expire_time: o.expire_time ? moment.unix(o.expire_time).format('YYYY-MM-DD') : '',
    }));

    let taskList_2 = await this.model('v_task').where({
      user_id,status:'完成'
    }).select();
    taskList_2 = _.map(taskList_2, o=>({
      ...o,
      finish_time: o.finish_time ? moment.unix(o.finish_time).fromNow() : ''
    }));

    this.assign({articleTypeList, projectGroup, workflowList, workflowList_0,workflowList_1,taskList_1,taskList_2});
    return this.display();
  }

  async profileAction(){
    if(this.isGet()){
      let { id:user_id } = this.user;
      this.pageConfig.breadcrumbList.push({
        name:'个人信息', href:'/user/profile'
      });

      let item = await this.model('user').where({id:user_id}).find();
      this.assign({item});
      return this.display();
    }else{
      let { id:user_id } = this.user;
      let { oper, id, ...oth } = this.param();
      await this.model('user').where({id:user_id}).update(oth);
      return this.success(user_id);
    }
  }

  async passwordAction(){
    if(this.isGet()){
      let { id:user_id } = this.user;
      this.pageConfig.breadcrumbList.push(
        {name:'个人信息', href:'/user/profile'},
        {name:'修改密码'}
      );

      let item = await this.model('user').where({id:user_id}).find();
      this.assign({item});
      return this.display();
    }else{
      let { old_password, new_password } = this.param();
      let { id:user_id } = this.user;

      let user = await this.model('user').where({id:user_id}).find();
      if(!think.isEmpty(user)){
        if(user.password != old_password){
          return this.fail(602, '旧密码错误');
        }else{
          await this.model('user').where({id:user_id}).update({
            password: new_password
          })
          return this.success();
        }
      }else{
        return this.fail(601, '用户不存在');
      }
    }
  }

  async uploadAction(){
    let create_time = moment().unix();
    let { id: user_id } = this.user;

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

  async downloadAction(){
    let { id } = this.param();
    let item = await this.model('attach').where({id}).find();
    return this.download(think.RUNTIME_PATH + '/' + item.hash, item.type, encodeURIComponent(item.name));
  }

  async projectAction(){

    if(!this.isAjax()){
      let { area_id, project_type_id:type_id } = this.user;
      area_id = _.toString(area_id);
      type_id = _.toString(type_id);
      this.pageConfig.breadcrumbList.push(
        {name:'建设管理', href:'/user/project'}
      );
      let { year:yearValue='', area:areaValue=area_id, type:typeValue=type_id, status:statusValue='', subtype:subtypeValue='' } = this.param();

      // 年份
      let yearList = await this.model('project').field('year').group('year').select();
      let { yearList:othYearList } = await this.config('app');
      yearList = _.orderBy(yearList, 'year','desc');
      yearList = [
        {name:'全部年份', value:'q'},
        ..._.map(yearList, o=>({ name:o.year+'年', value:o.year})),
        ...othYearList
      ];
      let year = _.find(yearList, {value:yearValue}) || yearList[1];

      // 区域
      let areaList = this.config('app').projectAreaList;//await this.model('area').select();
      areaList = [
        ..._.map(areaList, o=>({ name:o.name, value:o.id+''})),
      ];
      let area = _.find(areaList, {value:areaValue}) || areaList[0];

      // 类型
      let typeList = await this.model('project_type').where({parent_id:null}).select();
      typeList = [
        {name:'全部类型', value:'', selected_name:'类型'},
        ..._.map(typeList, o=>({ name:o.name, value:o.id+''})),
      ];
      let type = _.find(typeList, {value:typeValue}) || typeList[0];

      let subtypeList = [];
      if(typeValue){
        subtypeList = await this.model('project_type').where({parent_id:typeValue}).select();
      }else{
        subtypeList = await this.model('project_type').where({parent_id:['!=',null]}).select();
      }

      subtypeList = [
        {name:'全部项目', value:'', selected_name:'项目'},
        ..._.map(subtypeList, o=>({ name:o.name, value:o.id+''}))
      ];
      let subtype = _.find(subtypeList, {value:subtypeValue}) || subtypeList[0];

      // 状态
      let statusList = _.map(['前期阶段', '招投标阶段', '施工阶段', '决策审计阶段', '竣工验收'],o=>({name:o,value:o}));
      statusList = [
        ...statusList,
        {name:'全部状态', value:'', selected_name:'状态'},
      ];
      let status = _.find(statusList, {value:statusValue});

      this.assign({year, yearList, area, areaList, type, typeList, subtype, subtypeList, status, statusList});

      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id: user_id } = this.user;
      let { status, year, area, type, subtype } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      if(user_id) where['user_id|create_user_id'] = user_id;
      if(status) where['status'] = status;
      if(~year.indexOf('-')){
        where['year'] = ['BETWEEN', year.split('-')];
      }else if(year != 'q'){
        where['year'] = year;
      }
      if(area && area != '10000') where['area_id']=area;
      if(type) where['type_1']=type;
      if(subtype) where['type_id'] = subtype;

      let data = await this.model('v_user_project')
        .distinct('id,name,tzgm,kg_time,jhwc_time,wctz,xxjd,jlje,jljd,zfje,zfjd,wgys_time,jgys_time,dwtz,status')
        .where(where)
        .page(start/length+1, length)
        .countSelect();
      return this.json({
        recordsTotal: data.count,
        recordsFiltered: data.count,
        data: _.map(data.data, o=>({
          ...o,
          kg_time: o.kg_time ? moment.unix(o.kg_time).format('YYYY-MM-DD') : '-',
          jhwc_time: o.jhwc_time ? moment.unix(o.jhwc_time).format('YYYY-MM-DD') : '-',
          wgys_time: o.wgys_time ? moment.unix(o.wgys_time).format('YYYY-MM-DD') : '-',
          jgys_time: o.jgys_time ? moment.unix(o.jgys_time).format('YYYY-MM-DD') : '-'
        }))
      });
    }
  }

  async workflowAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'办理事项', href:'/user/workflow'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id: user_id } = this.user;
      let { kind } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['project_name'] = ['like', `%${searchKey}%`];

      let data;
      if(kind == '1'){
        where['current_user_id'] = user_id;
        data = await this.model('v_workflow')
          .where(where)
          .order(order)
          .page(start/length+1, length)
          .countSelect();
      }else if(kind == '2'){
        where['a.user_id'] = user_id;
        data = await this.model('workflow_reply')
          .distinct('b.id')
          .field('b.*')
          .alias('a')
          .join({table:'v_workflow', as:'b', on:['b.id', 'a.workflow_id']})
          .where(where)
          .order(order)
          .page(start/length+1, length)
          .countSelect();
      }else if(kind == '3'){
        where['user_id'] = user_id;
        data = await this.model('v_workflow')
          .where(where)
          .order(order)
          .page(start/length+1, length)
          .countSelect();
      }

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

  async taskAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'工作任务', href:'/user/task'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id: user_id } = this.user;
      let { kind='1' } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      where['user_id'] = user_id;
      if(kind == '1'){
        where['status'] = null;
      }else if(kind == '2'){
        where['status'] = '完成';
      }

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

  async articleAction(){
    if(!this.isAjax()){
      let { type_id } = this.param();
      this.pageConfig.breadcrumbList.push(
        {name:'文章栏目', href:'/user/article'}
      );

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

        this.pageConfig.breadcrumbList.push(..._.map(typePath, o=>({
          name:o.name, href:`/user/article?type_id=${o.id}`
        })))

        this.assign({typePath});
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

  async articleViewAction(){
    let { id } = this.param();
    let { attach_id, ...item} = await this.model('article').where({id}).find();

    this.pageConfig.breadcrumbList.push(
      {name:'文章栏目', href:'/user/article'}
    );
    let typeList = await this.model('article_type').select();

    let typePath = [];
    let next_type_id = item.type_id;
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

    this.pageConfig.breadcrumbList.push(..._.map(typePath, o=>({
      name:o.name, href:`/user/article?type_id=${o.id}`
    })))

    this.pageConfig.breadcrumbList.push(
      {name:item.name}
    );

    if(attach_id){
      let attachList = await this.model('attach').where({id:attach_id.split(',')}).select();
      this.assign({attachList});
    }

    this.assign({item});
    return this.display();
  }

  async statAction(){
    this.pageConfig.breadcrumbList.push(
      {name:'统计查询', href:'/user/stat'}
    );

    let { year: yearValue, type_id, export_excel, print } = this.param();

    let areaList = this.config('app').projectAreaList;//await this.model('area').select();
    let topTypeList = await this.model('project_type').where({parent_id:null}).order('sort', 'asc').select();

    let type;
    if(type_id){
      type = await this.model('project_type').where({id:type_id}).find();
      if(think.isEmpty(type)){
        type = null
      }
    }

    if(type){
      this.pageConfig.breadcrumbList.push(
        {name:type.name}
      );
    }

    let typeList = await this.model('project_type').where({parent_id:type_id||null}).order('sort', 'asc').select();

    let yearList = await this.model('project').field('year').group('year').select();
    let othYearList = await this.config('app').yearList;
    yearList = _.orderBy(yearList, 'year','desc');
    yearList = [
      ..._.map(yearList, o=>({ name:o.year+'年', value:o.year})),
      ...othYearList
    ];

    let year = yearValue ? _.find(yearList, {value:yearValue}) : yearList[0]

    let where = {};
    if(year){
      if(~year.value.indexOf('-')){
        where['year'] = ['BETWEEN', year.value.split('-')];
      }else{
        where['year'] = year.value;
      }
    }

    if(type){
      where['type_1'] = type.id;
    }

    let projectList = await this.model('v_project').where(where).select();
    projectList = _.map(projectList, o=>({
      ...o,
      kg_time: o.kg_time ? moment.unix(o.kg_time).format('YYYY-MM-DD') : '-',
      jhwc_time: o.jhwc_time ? moment.unix(o.jhwc_time).format('YYYY-MM-DD') : '-',
      wgys_time: o.wgys_time ? moment.unix(o.wgys_time).format('YYYY-MM-DD') : '-',
      jgys_time: o.jgys_time ? moment.unix(o.jgys_time).format('YYYY-MM-DD') : '-'
    }));

    if(export_excel){

      let workbook = new ExcelJS.Workbook();
      let sheet = workbook.addWorksheet('统计');
      // 第一行 表名
      setProps({
        height: 50,
        alignment: { vertical: 'middle', horizontal: 'center' },
        font: { size: 30, bold: true}
      }, [sheet.addRow([`${year.name}${type ? type.name :''}工程建设进度统计表`])]);
      sheet.mergeCells(1,1,1,_.size(typeList)*3+4);

      // 第二行 标题一
      setProps({
        alignment:{vertical: 'middle', horizontal: 'center'},
        font: { size: 16, bold: true},
        height: 30
      }, [sheet.addRow(['县(区)别', '合计','','',..._.flatten(_.map(typeList,o=>[o.name,'','']))])]);
      sheet.mergeCells(2,2,2,4);
      _.map(typeList, (o,i)=>{
        sheet.mergeCells(2,5+i*3,2,7+i*3)
      })

      // 第三行 标题二
      setProps({
        alignment:{vertical: 'middle', horizontal: 'center'},
        font: { size: 14},
        height: 20
      }, [sheet.addRow(['','总投资','完成投资','工程进度', ..._.flatten(_.map(typeList,o=>['总投资','完成投资','工程进度']))])]);
      sheet.mergeCells(2,1,3,1);

      // 第四行 合计数据
      setProps({
        alignment:{vertical: 'middle', horizontal: 'center'},
        font: { size: 12},
        height: 15
      }, [sheet.addRow(['全市合计', ...(()=>{
        let tzgm=0,wctz=0,gcjd=0,xmgs = 0;
        _.forEach(projectList, o=>{
          tzgm = tzgm + (o.tzgm || 0);
          wctz = wctz + (o.wctz || 0);
          gcjd = gcjd + (o.progress || 0);
          xmgs = xmgs + 1;
        });
        return [xmgs?tzgm:'-',xmgs?wctz:'-',xmgs?(gcjd/xmgs).toFixed(0)+'%':'-']
      })(), ..._.flatten(_.map(typeList, p=>{
        let tzgm=0, wctz=0, gcjd=0, xmgs=0;
        _.forEach(projectList, o=>{
          if (o.type_1 == p.id || o.type_id == p.id){
            tzgm = tzgm + (o.tzgm || 0);
            wctz = wctz + (o.wctz || 0);
            gcjd = gcjd + (o.progress || 0);
            xmgs = xmgs + 1;
          }
        });
        return [xmgs?tzgm:'-',xmgs?wctz:'-',xmgs?(gcjd/xmgs).toFixed(0)+'%':'-']
      }))])]);

      // 以下各行 按各区域统计显示
      setProps({
        alignment:{vertical: 'middle', horizontal: 'center'},
        font: { size: 12},
        height: 15
      },_.map(areaList, p=>{
        return sheet.addRow([p.name, ...(()=>{
          let tzgm=0,wctz=0,gcjd=0,xmgs = 0;
          _.forEach(projectList, o=>{
            if(o.area_id == p.id){
              tzgm = tzgm + (o.tzgm || 0);
              wctz = wctz + (o.wctz || 0);
              gcjd = gcjd + (o.progress || 0);
              xmgs = xmgs + 1;
            }
          });
          return [xmgs?tzgm:'-',xmgs?wctz:'-',xmgs?(gcjd/xmgs).toFixed(0)+'%':'-']
        })(),..._.flatten(_.map(typeList, q=>{
          let tzgm=0,wctz=0,gcjd=0,xmgs = 0;
          _.forEach(projectList, o=>{
            if((o.type_1 == q.id || o.type_id == q.id) &&  o.area_id == p.id){
              tzgm = tzgm + (o.tzgm || 0);
              wctz = wctz + (o.wctz || 0);
              gcjd = gcjd + (o.progress || 0);
              xmgs = xmgs + 1;
            }
          });
          return [xmgs?tzgm:'-',xmgs?wctz:'-',xmgs?(gcjd/xmgs).toFixed(0)+'%':'-']
        }))]);
      }));

      setProps({
        width:15
      },[sheet.getColumn(1)])

      for(let i = 2; i <= sheet.columnCount; i++){
        setProps({
          width:10
        },[sheet.getColumn(i)])
      }

      drawBorder(sheet);


      sheet = workbook.addWorksheet('明细表');
      setProps({
        height: 50,
        alignment: { vertical: 'middle', horizontal: 'center' },
        font: { size: 30, bold: true}
      }, [sheet.addRow([`${year.name}${type ? type.name :''}工程建设进度明细表`])]);
      sheet.mergeCells(1,1,1,13);

      setProps({
        alignment: { vertical: 'middle', horizontal: 'center' },
        font: { size: 16, bold: true}
      },[sheet.addRow([
        '项目名称','总投资(万元)','分布乡镇','开工时间','计划完成时间',
        '完成投资(万元)','形象进度(%)','计量金额(万元)','计量进度(%)',
        '支付金额(万元)','支付进度(%)','完工验收时间','竣工验收时间'])]);

      setProps({
        width:60,
        alignment:{ vertical: 'middle', horizontal: 'right'},
      },[sheet.getColumn(1)]);

      setProps({
        width:20,
        alignment:{ vertical: 'middle', horizontal: 'center'},
      },[
        sheet.getColumn(2),sheet.getColumn(3),sheet.getColumn(4),sheet.getColumn(5),
        sheet.getColumn(6),sheet.getColumn(7),sheet.getColumn(8),sheet.getColumn(9),
        sheet.getColumn(10),sheet.getColumn(11),sheet.getColumn(12),sheet.getColumn(13),
      ]);


      setProps({
        font: { size: 12},
        height: 15
      },[sheet.addRow((()=>{
        let tzgm=0, wctz=0, jlje=0, zfje=0, xmgs=0,xxjd=0,jljd=0,zfjd=0;
        _.forEach(projectList, o=>{
          tzgm = tzgm + (o.tzgm || 0);
          wctz = wctz + (o.wctz || 0);
          jlje = jlje + (o.jlje || 0);
          zfje = zfje + (o.zfje || 0);
          xxjd = xxjd + (o.xxjd || 0);
          jljd = jljd + (o.jljd || 0);
          zfjd = zfjd + (o.zfjd || 0);
          xmgs = xmgs + 1;
        })

        return ['合计',tzgm,'','','',
          wctz,xmgs ? (xxjd/xmgs).toFixed(0) : '-',
          jlje,xmgs ? (jljd/xmgs).toFixed(0) : '-',
          zfje,xmgs ? (zfjd/xmgs).toFixed(0) : '-'
        ];
      })())]);

      setProps({
        font: { size: 12},
        height: 15
      },_.map(projectList, o=>{
        return sheet.addRow([
          o.name,o.tzgm,o.address,o.kg_time,o.jhwc_time,
          o.wctz,o.xxjd,o.jlje,o.jljd,
          o.zfje,o.zfjd,o.wgys_time,o.jgys_time]);
      }));

      drawBorder(sheet);

      this.type(require('mime').lookup('xlsx'), false);
      let filename = `${year.name}${type ? type.name :''}_工程建设进度统计表.xlsx`;
      this.header('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');
      workbook.xlsx.write(this.http.res);
    }else{
      this.assign({projectList,areaList, type, typeList, topTypeList,year,yearList});
      if(print) return this.display('stat_print');
      else return this.display();
    }
  }

  async statProgressAction(){
    this.pageConfig.breadcrumbList.push(
      {name:'统计查询', href:'/user/stat'}
    );

    let { year: yearValue, type_id, area_id,export_excel, print } = this.param();

    let areaList = this.config('app').projectAreaList;//await this.model('area').select();
    let topTypeList = await this.model('project_type').where({parent_id:null}).select();

    let type;
    if(type_id){
      type = await this.model('project_type').where({id:type_id}).find();
      if(think.isEmpty(type)){
        type = null
      }
    }

    let area;
    if(area_id){
      let { projectAreaList } = this.config('app');
      area = _.find(projectAreaList, {id:area_id});//await this.model('area').where({id:area_id}).find();
      if(think.isEmpty(area)){
        area = null;
      }
    }

    let typeList = await this.model('project_type').where({parent_id:type_id||null}).select();

    let yearList = await this.model('project').field('year').group('year').select();
    let othYearList = await this.config('app').yearList;
    yearList = _.orderBy(yearList, 'year','desc');
    yearList = [
      ..._.map(yearList, o=>({ name:o.year+'年', value:o.year})),
      ...othYearList
    ];

    let year = yearValue ? _.find(yearList, {value:yearValue}) : yearList[0]

    let where = {};
    if(year){
      if(~year.value.indexOf('-')){
        where['year'] = ['BETWEEN', year.value.split('-')];
      }else{
        where['year'] = year.value;
      }
    }

    if(type){
      where['type_1|type_id'] = type.id;
      let yearlink = year ? `&year=${year.value}`:'';
      this.pageConfig.breadcrumbList.push(
        {name:type.name, href:`/user/stat?type_id=${type.id}${yearlink}`}
      );
    }
    if(area){
      where['area_id'] = area.id;
      this.pageConfig.breadcrumbList.push(
        {name:area.name}
      );
    }

    let projectList = await this.model('v_project').where(where).select();
    projectList = _.map(projectList, o=>({
      ...o,
      kg_time: o.kg_time ? moment.unix(o.kg_time).format('YYYY-MM-DD') : '-',
      jhwc_time: o.jhwc_time ? moment.unix(o.jhwc_time).format('YYYY-MM-DD') : '-',
      wgys_time: o.wgys_time ? moment.unix(o.wgys_time).format('YYYY-MM-DD') : '-',
      jgys_time: o.jgys_time ? moment.unix(o.jgys_time).format('YYYY-MM-DD') : '-'
    }));

    if(export_excel){
      let workbook = new ExcelJS.Workbook();
      let sheet = workbook.addWorksheet('明细表');
      setProps({
        height: 50,
        alignment: { vertical: 'middle', horizontal: 'center' },
        font: { size: 30, bold: true}
      }, [sheet.addRow([`${year.name}${type ? type.name :''}工程建设进度明细表`])]);
      sheet.mergeCells(1,1,1,13);

      setProps({
        alignment: { vertical: 'middle', horizontal: 'center' },
        font: { size: 16, bold: true}
      },[sheet.addRow([
        '项目名称','总投资(万元)','分布乡镇','开工时间','计划完成时间',
        '完成投资(万元)','形象进度(%)','计量金额(万元)','计量进度(%)',
        '支付金额(万元)','支付进度(%)','完工验收时间','竣工验收时间'])]);

      setProps({
        width:60,
        alignment:{ vertical: 'middle', horizontal: 'right'},
      },[sheet.getColumn(1)]);

      setProps({
        width:20,
        alignment:{ vertical: 'middle', horizontal: 'center'},
      },[
        sheet.getColumn(2),sheet.getColumn(3),sheet.getColumn(4),sheet.getColumn(5),
        sheet.getColumn(6),sheet.getColumn(7),sheet.getColumn(8),sheet.getColumn(9),
        sheet.getColumn(10),sheet.getColumn(11),sheet.getColumn(12),sheet.getColumn(13),
      ]);


      setProps({
        font: { size: 12},
        height: 15
      },[sheet.addRow((()=>{
        let tzgm=0, wctz=0, jlje=0, zfje=0, xmgs=0,xxjd=0,jljd=0,zfjd=0;
        _.forEach(projectList, o=>{
          tzgm = tzgm + (o.tzgm || 0);
          wctz = wctz + (o.wctz || 0);
          jlje = jlje + (o.jlje || 0);
          zfje = zfje + (o.zfje || 0);
          xxjd = xxjd + (o.xxjd || 0);
          jljd = jljd + (o.jljd || 0);
          zfjd = zfjd + (o.zfjd || 0);
          xmgs = xmgs + 1;
        })

        return ['合计',tzgm,'','','',
          wctz,xmgs ? (xxjd/xmgs).toFixed(0) : '-',
          jlje,xmgs ? (jljd/xmgs).toFixed(0) : '-',
          zfje,xmgs ? (zfjd/xmgs).toFixed(0) : '-'
        ];
      })())]);

      setProps({
        font: { size: 12},
        height: 15
      },_.map(projectList, o=>{
        return sheet.addRow([
          o.name,o.tzgm,o.address,o.kg_time,o.jhwc_time,
          o.wctz,o.xxjd,o.jlje,o.jljd,
          o.zfje,o.zfjd,o.wgys_time,o.jgys_time]);
      }));

      drawBorder(sheet);

      this.type(require('mime').lookup('xlsx'), false);
      let filename = `${year.name}${type ? type.name :''}_工程建设进度统计表.xlsx`;
      this.header('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');
      workbook.xlsx.write(this.http.res);
    }else{
      this.assign({projectList,area, areaList, type, typeList, topTypeList,year,yearList});
      if(print) return this.display('stat_progress_print');
      else return this.display();
    }
  }

  async projectEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      this.pageConfig.breadcrumbList.push({
        name:'建设管理', href:'/user/project'
      }, {
        name:id?'编辑项目':'创建项目'
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
        let { id: user_id } = this.user;
        id = await this.model('project').add({
          ...oth,
          create_user_id: user_id
        });

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

  async messageAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push({
        name:'政务办公', href:'/user/task'
      });
      return this.display();
    }else{
      let { start, length, ...oth } = this.param();
      let { id: user_id } = this.user;
      let { kind='1' } = this.param();

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];
      if(kind == '1'){
        where['user_id'] = user_id;
        where['view_time'] = null;
      }else if(kind == '2'){
        where['user_id'] = user_id;
        where['view_time'] = ['!=', null];
      }else if(kind == '3'){
        where['from_user_id'] = user_id;
      }

      let data = await this.model('v_message')
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

  async messageEditAction(){
    if(this.isGet()){
      let { id, tid, kind } = this.param();
      let { id: user_id } = this.user;

      if(id){
        let { attach_id, ...item} = await this.model('message').where({id}).find();
        if(attach_id){
          let attachList = await this.model('attach').where({id:attach_id.split(',')}).select();
          this.assign({attachList});
        }
        this.assign({item});
      }else if(tid){
        let titem = await this.model('message').where({id:tid}).find();
        let item = {
          parent_id: tid,
          root_id: titem.root_id
        };
        if(kind == 1){
          item.user_id = titem.from_user_id;
        }else if(kind == 2){
          item.user_id = titem.user_id;
        }else if(kind == 3){
          item.name = titem.name;
          item.content = titem.content;
          let attach_id = titem.attach_id;
          item.attach_id = attach_id;
          if(attach_id){
            let attachList = await this.model('attach').where({id:attach_id.split(',')}).select();
            this.assign({attachList});
          }
        }

        this.assign({item})
      }

      this.pageConfig.breadcrumbList.push({
        name:'政务公文', href:'/user/message'
      }, {
        name:id?'编辑公文':'发送公文'
      });

      let userList = await this.model('user').select();
      userList = _.filter(userList, o=>o.id!=user_id);
      this.assign({userList});
      return this.display();
    }else{
      let { oper, id, ...oth } = this.param();
      let { id: user_id } = this.user;

      if(oper == 'add'){
        oth.create_time = moment().unix();
        oth.from_user_id = user_id;
        oth.root_id = oth.root_id || null;
        oth.parent_id = oth.parent_id || null;
        id = await this.model('message').add(oth);
      }else if(oper == 'edit'){
        await this.model('message').where({id}).update(oth);
      }

      return this.success(id);
    }
  }

  async messageViewAction(){
    let { id } = this.param();
    let { id: user_id } = this.user;

    let item = await this.model('v_message').where({id}).find();

    if(!item.view_time && user_id == item.user_id){
      await this.model('message').where({id}).update({
        view_time: moment().unix()
      })
    }

    let itemList = await this.model('v_message').where({root_id:item.root_id}).select();

    itemList = _.reverse(_.sortBy(itemList, 'create_time'));

    let attachIds = _.flatten(_.map(itemList, o=>o.attach_id ? o.attach_id.split(',') : []));
    let attachList = await this.model('attach').where({id:attachIds}).select();

    let timeIndex = null;
    itemList = _.reduce(itemList, (result, o)=>{
      let time = moment.unix(o.create_time).format('YYYY-MM-DD');

      o.create_time = o.create_time ? moment.unix(o.create_time).format('YYYY-MM-DD HH:mm:ss') : '';
      o.view_time = o.view_time ? moment.unix(o.view_time).format('YYYY-MM-DD HH:mm:ss') : '';
      if(o.attach_id){
        let ids = o.attach_id ? o.attach_id.split(',') : [];
        o.attachList = _.filter(attachList, p=>~ids.indexOf(p.id+''))
      }
      if(timeIndex != time){
        result.push({type:'sep', title:time});
        timeIndex = time;
      }
      result.push(o);
      return result;
    },[]);

    this.assign({item,itemList});

    this.pageConfig.breadcrumbList.push({
      name:'政务公文', href:'/user/message'
    }, {
      name:'浏览公文'
    });

    return this.display();
  }

  async docflowAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push(
        {name:'政务办公'}
      )

      return this.display();
    }else{
      let { kind, start, length, ...oth } = this.param();
      let { id: user_id } = this.user;

      let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data;
      if(kind == '1'){
        where['a.user_id'] = user_id;
        where['last_reply_id'] = null;
        data = await this.model('v_docflow_user')
          .field('a.id as duid, a.user_name as to_user_name, b.*')
          .alias('a')
          .join({table:'v_docflow', as:'b', on:['b.id', 'a.docflow_id']})
          .where(where)
          .order(order)
          .page(start/length+1, length)
          .countSelect();
      }else if(kind == '2'){
        where['a.user_id'] = user_id;
        where['last_reply_id'] = ['!=',null];
        data = await this.model('v_docflow_user')
          .field('a.id as duid, a.user_name as to_user_name, b.*')
          .alias('a')
          .join({table:'v_docflow', as:'b', on:['b.id', 'a.docflow_id']})
          .where(where)
          .order(order)
          .page(start/length+1, length)
          .countSelect();
      }else if(kind == '3'){
        where['user_id'] = user_id;
        data = await this.model('v_docflow')
          .where(where)
          .order(order)
          .page(start/length+1, length)
          .countSelect();

        let ids = _.map(data.data,'id');

        if(ids.length){
          let userList = await this.model('v_docflow_user').where({docflow_id:ids}).select();
          data.data = _.map(data.data, o=>({
            ...o,
            to_user_name: _.map(_.filter(userList, {docflow_id:o.id}), 'user_name').join(','),
          }))
        }
      }

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

  async docflowEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      let { id: user_id } = this.user;

      this.pageConfig.breadcrumbList.push(
        {name:'政务公文', href:'/user/docflow'},
        {name:id?'编辑发文':'发送公文'}
      )
      this.pageConfig.user = await this.session('user');

      if(id){
        let item = await this.model('docflow').where({id}).find();
        this.assign({item});
      }

      let areaList = this.config('app').userAreaList;//await this.model('area').select();
      let userList = await this.model('user').where({'area_id':_.map(areaList, 'id')}).select();
      let formTmplList = await this.model('form_tmpl').select();
      this.assign({areaList,userList,formTmplList});
      return this.display();
    }else{
      let { oper, id, to_user_id, ...oth } = this.param();

      if(oper == 'add'){
        oth.current_user_id = oth.next_user_id;
        oth.status = '申请';
        oth.create_time = moment().unix();
        id = await this.model('docflow').add(oth);

        await this.model('docflow_user').addMany(_.map(to_user_id.split(','),o=>({
          user_id:o,docflow_id:id
        })));

      }else if(oper == 'edit'){
        await this.model('docflow').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async docflowReplyAction(){
    if(this.isGet()){

      let { id, duid } = this.param();
      let { id: user_id } = this.user;

      if(duid){
        let du_item = await this.model('docflow_user').where({id:duid}).find();
        id = du_item.docflow_id;
      }
      let item = await this.model('v_docflow').where({id}).find();
      item.create_time = moment.unix(item.create_time).format('YYYY-MM-DD HH:mm:ss');

      if(item.attach_id){
        item.attachList = await this.model('attach').where({id:_.map(item.attach_id.split(','))}).select();
      }

      let toUserList = await this.model('v_docflow_user').where({docflow_id:id,reply_id:null}).select();
      if(!think.isEmpty(toUserList))
      {
        item.to_user_name = _.map(toUserList, 'user_name').join(',');
      }

      let waitUserList = await this.model('v_docflow_user').where({docflow_id:id,last_reply_id:null}).select();
      if(!think.isEmpty(waitUserList))
      {
        item.wait_user_name = _.uniq(_.map(waitUserList, 'user_name')).join(',');
      }

      this.pageConfig.breadcrumbList.push(
        {name:'政务办公', href:`/user/docflow`},
        {name:'公文办理'}
      )
      this.pageConfig.user = await this.session('user');
      this.pageConfig.docflow = item;

      let formTmplList = await this.model('form_tmpl').select();
      let replyList = await this.model('docflow_reply')
        .field('a.*, b.name as user_name')
        .alias('a')
        .join({table:'user', as:'b', on:['b.id', 'a.user_id']})
      .where({docflow_id:id}).select();
      replyList = Promise.all(_.map(replyList, async o=>{
        if(o.attach_id){
          o.attachList = await this.model('attach').where({id:_.map(o.attach_id.split(','))}).select();
        }

        let toUserList = await this.model('v_docflow_user').where({docflow_id:id,reply_id:o.id}).select();
        if(!think.isEmpty(toUserList))
        {
          o.to_user_name = _.map(toUserList, 'user_name').join(',');
        }
        return {
          ...o,
          create_time: moment.unix(o.create_time).format('YYYY-MM-DD HH:mm:ss'),
        }
      }));

      let areaList = this.config('app').userAreaList;//await this.model('area').select();
      let userList = await this.model('user').where({'area_id':_.map(areaList, 'id')}).select();
      this.assign({areaList,userList,formTmplList,replyList});
      return this.display();
    }else{
      let { oper, id, duid, to_user_id, ...oth } = this.param();

      let now = moment().unix();
      let ret_id = await this.model('docflow_reply').add({
        ...oth,
        docflow_id: id,
        create_time: now
      });

      let df = {update_time:now};
      if(oth.next_user_id){
        df.current_user_id = oth.next_user_id;
        df.status = '';
      }
      else{
        df.current_user_id = null;
        df.status = oth.status;
      }

      await this.model('docflow').where({id}).update(df);

      if(duid){
        await this.model('docflow_user').where({id:duid}).update({
          last_reply_id: ret_id
        })
      }

      if(to_user_id){
        await this.model('docflow_user').addMany(_.map(to_user_id.split(','),o=>({
          user_id:o,docflow_id:id,reply_id:ret_id
        })));
      }


      return this.success(ret_id);
    }
  }

  async docflowUserEditAction(){
    if(this.isGet()){

    }else{
      let {oper, id } = this.param();

      if(oper == 'del'){
        await this.model('docflow_user').where({id}).delete();
        return this.success();
      }
    }
  }

  async mailAction(){
    if(!this.isAjax()){
      this.pageConfig.breadcrumbList.push(
        {name:'政务办公'}
      )

      return this.display();
    }else{
      let { kind, start, length, ...oth } = this.param();
      let { id: user_id } = this.user;

      // let orderIndex = oth['order[0][column]'], orderDirect = oth['order[0][dir]'];
      // let order = {[oth[`columns[${orderIndex}][data]`]]:orderDirect};

      let where = {};
      let searchKey = oth['search[value]'];
      if(searchKey) where['name'] = ['like', `%${searchKey}%`];

      let data;
      if(kind == '1'){
        where['to_user_id'] = user_id;
        where['view_time'] = null;
        data = await this.model('v_user_mail')
          .where(where)
          // .order(order)
          .page(start/length+1, length)
          .countSelect();
      }else if(kind == '2'){
        where['to_user_id'] = user_id;
        where['view_time'] = ['!=',null];
        data = await this.model('v_user_mail')
          .where(where)
          // .order(order)
          .page(start/length+1, length)
          .countSelect();
      }else if(kind == '3'){
        where['user_id'] = user_id;
        data = await this.model('v_mail')
          .where(where)
          // .order(order)
          .page(start/length+1, length)
          .countSelect();

        let mailIdList = _.map(data.data,'id');

        if(mailIdList.length){
          let mailUserList = await this.model('v_mail_user').where({mail_id:mailIdList}).select();
          data.data = _.map(data.data, o=>({
            ...o,
            to_user_name: _.map(_.filter(mailUserList, {mail_id:o.id}), 'user_name').join(','),
          }))
        }
      }



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

  async mailEditAction(){
    if(this.isGet()){
      let { id, reply_id, forward_id } = this.param();
      let { id: user_id } = this.user;

      this.pageConfig.breadcrumbList.push(
        {name:'政务公文', href:'/user/mail'},
        {name:id?'编辑发文':'发送公文'}
      )
      this.pageConfig.user = await this.session('user');

      let item = {};
      if(id){
        item = await this.model('mail').where({id}).find();
      }

      if(reply_id){
        item = await this.model('v_mail').where({id:reply_id}).find();
        item = {
          to_user_id: [item.user_id+''],
          name: '回复：'+item.name,
          content : '<br><br><br><br>'
           + `发件人：${item.user_name}` + '<br>'
           + `发件时间：${moment.unix(item.create_time).format('YYYY-MM-DD HH:mm:ss')}` + '<br>'
           + '-----正文-----' + '<br>'
           + item.content + '<br>'
           + '----------' + '<br>'
          //attach_id: item.attach_id
        }
      }else if(forward_id){
        item = await this.model('v_mail').where({id:forward_id}).find();
        item = {
          name: '转发：'+item.name,
          attach_id: item.attach_id,
          content : '<br><br><br><br>'
           + `发件人：${item.user_name}` + '<br>'
           + `发件时间：${moment.unix(item.create_time).format('YYYY-MM-DD HH:mm:ss')}` + '<br>'
           + '-----正文-----' + '<br>'
           + item.content + '<br>'
           + '----------' + '<br>'
        }
      }

      let areaList = this.config('app').userAreaList;//await this.model('area').select();
      let userList = await this.model('user').select();
      if(item.to_user_id){
        let ids = item.to_user_id;
        userList = _.map(userList, o=>{
          return {
            ...o,
            selected: ~ids.indexOf(_.toString(o.id))
          }
        })
      }
      let attachList = [];
      if(item.attach_id){
        item.attachList = await this.model('attach').where({id:_.map(item.attach_id.split(','))}).select();
      }
      this.assign({item,areaList,userList});
      return this.display();
    }else{
      let { oper, id, to_user_id, ...oth } = this.param();

      if(oper == 'add'){

        oth.create_time = moment().unix();
        id = await this.model('mail').add(oth);

        await this.model('mail_user').addMany(_.map(to_user_id.split(','),o=>({
          user_id:o,mail_id:id
        })));
      }else if(oper == 'edit'){
        await this.model('docflow').where({id}).update(oth);
      }
      return this.success(id);
    }
  }

  async mailViewAction(){
    let { id, mu_id } = this.param();
    let { id: user_id } = this.user;
    if(mu_id){
      let mu_item = await this.model('mail_user').where({id:mu_id}).find();
      id = mu_item.mail_id;
      await this.model('mail_user').where({id:mu_id}).update({
        view_time: moment().unix()
      })
    }
    let item = await this.model('v_mail').where({id}).find();

    item.create_time = moment.unix(item.create_time).format('YYYY-MM-DD HH:mm:ss');

    if(item.attach_id){
      item.attachList = await this.model('attach').where({id:_.map(item.attach_id.split(','))}).select();
    }

    let userList = await this.model('v_mail_user').where({mail_id:id}).select();
    if(!think.isEmpty(userList)){
      item.to_user_name = _.map(userList,'user_name').join(',');
    }

    this.pageConfig.breadcrumbList.push(
      {name:'政务办公', href:`/user/mail`},
      {name:'查看公文'}
    )
    this.pageConfig.user = await this.session('user');
    this.assign({item});
    return this.display();
  }
}
