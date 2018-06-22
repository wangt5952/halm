'use strict';
import _ from 'lodash';
export default {
  name: '淮安市水利工程建设智能化管理系统',
  bd_max: 3,

  type2name:{
    'application/msword':'文档',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'文档',
    'application/pdf':'文档',
    'image/png':'图片','image/jpeg':'图片',
  },

  authTree: [
    {code:'st', name:'统计查询'},
    {code:'cp', name:'项目创建'},
    {code:'admin', name:'系统管理', children:[
      {code:'admin:article', name:'文章管理'}
    ]}
  ],

  pcRoleList:[
    {code:'js', name:'项目法人'},
    {code:'kc', name:'勘测单位'},
    {code:'sj', name:'设计单位'},
    {code:'jl', name:'监理单位'},
    {code:'sg_1', name:'1标施工单位'},
    {code:'sg_2', name:'2标施工单位'},
    {code:'sg_3', name:'3标施工单位'},
    {code:'jc', name:'检测单位'}
  ],

  puRoleList:[
    // 建设单位
    ..._.map([
      {code:'js_fzr', name:'常务副主任'},
      {code:'js_fzr2', name:'副主任'},
      {code:'js_jsfzr', name:'技术负责人'},
      {code:'js_cwfzr', name:'财务负责人'},
      {code:'js_gck', name:'工程科'},
      {code:'js_cwk', name:'财务科'},
      {code:'js_zhk', name:'综合科'},
    ], o=>({...o,group:'js'})),

    //勘测单位
    ..._.map([
      {code:'kc_fzr', name:'项目负责人'},
      {code:'kc_fzr2', name:'项目负责人'},
      {code:'kc_tj', name:'土建'},
      {code:'kc_mg', name:'水工'},
      {code:'kc_dq', name:'电气'},
      {code:'kc_sb', name:'设备'},
      {code:'kc_gs', name:'概算'},
    ], o=>({...o,group:'kc'})),


    //设计单位
    ..._.map([
      {code:'sj_fzr', name:'项目负责人'},
      {code:'sj_fzr2', name:'项目负责人'},
      {code:'sj_tj', name:'土建'},
      {code:'sj_sg', name:'水工'},
      {code:'sj_dq', name:'电气'},
      {code:'sj_sb', name:'设备'},
      {code:'sj_gs', name:'概算'},
    ], o=>({...o,group:'sj'})),

    //监理单位
    ..._.map([
      {code:'jl_zjlgcs', name:'总监理工程师'},
      {code:'jl_fzjlgcs', name:'副总监理工程师'},
      {code:'jl_jlgcs', name:'监理工程师'},
      {code:'jl_sg', name:'监理员(水工)'},
      {code:'jl_cl', name:'监理员(测量)'},
      {code:'jl_zj', name:'监理员(造价)'},
      {code:'jl_dq', name:'监理员(电气)'},
    ], o=>({...o,group:'jl'})),

    //施工单位
    ..._.flatten(_.map([1,2,3], p=>_.map([
      {code:'sg_xmjl_'+p, name:'项目经理'},
      {code:'sg_xmfjl_'+p, name:'项目副经理'},
      {code:'sg_gcjs_'+p, name:'工程技术'},
      {code:'sg_scaq_'+p, name:'安全生产'},
      {code:'sg_sgy_'+p, name:'施工员'},
      {code:'sg_zljy_'+p, name:'质量检验'},
      {code:'sg_cwgy_'+p, name:'财务供应'},
      {code:'sg_cly_'+p, name:'材料员'},
    ], o=>({...o,group:'sg_'+p})))),
    //检测单位
    {code:'jc_lxr', name:'联系人'},
    ..._.map([
      {code:'jc_lxr', name:'联系人'},
    ], o=>({...o,group:'jc'})),
  ],

  imageFormat:['image/png','image/jpeg','image/tiff'],

  yearList: [
    {name:'十二五期间',value:'2011-2015'},
    {name:'十三五期间',value:'2016-2020'}
  ],

  companyTypeList:[
    {name:'市水利局', value:'1'},
    {name:'区县水利局', value:'2'},
    {name:'建设', value:'3'},
    {name:'设计', value:'4'},
    {name:'施工', value:'5'},
    {name:'监理', value:'6'},
    {name:'检测', value:'7'},
    {name:'设备', value:'10'},
    {name:'材料', value:'11'}
  ],

  archiveTemplate:[
    {name:'设计(1)监理(1)施工(1)', archive:[
      {name:'建设单位', icon:'fa-cloud-upload', color:'text-purple', children:[
        {name:'前期工作'},
        {name:'招投标工作'},
        {name:'建设管理'},
        {name:'项目验收'},
      ]},
      {name:'设计单位', icon:'fa-file-text-o', color:'text-info', children:[
        {name:'勘查设计合同'},
        {name:'勘查设计工作大纲'},
        {name:'中标通知书'},
        {name:'地质勘察报告'},
        {name:'设计管理报告'},
        {name:'设计变更文件'},
      ]},
      {name:'监理单位', icon:'fa-exclamation', color:'text-danger', children:[
        {name:'监理合同'},
        {name:'中标通知书'},
        {name:'监理规划'},
        {name:'监理细则'},
        {name:'开工令'},
        {name:'项目划分'},
        {name:'施工图设计交底'},
        {name:'旁站记录'},
        {name:'计量审核'},
        {name:'监理通知书'},
        {name:'监理检查记录'},
        {name:'监理工作报告'},
        {name:'监理指示单'},
        {name:'监理日志'},
        {name:'监理管理工作报告'},
      ]},
      {name:'施工单位', icon:'fa-clock-o', color:'text-success', children:[
        {name:'施工合同'},
        {name:'施工准备'},
        {name:'开工令'},
        {name:'设备材料和零部件检验报告'},
        {name:'停工复工'},
        {name:'设计变更'},
        {name:'单元工程质量报验单及评定'},
        {name:'分部工程质量报验及评定'},
        {name:'单位工程评定'},
        {name:'计量证书'},
        {name:'结算资料'},
        {name:'施工日志'},
        {name:'施工管理工作报告'},
        {name:'竣工图'},
      ]},
      {name:'质量监督', icon:'fa-trophy', color:'text-pink', children:[
        {name:'质量监督请示'},
        {name:'质量监督巡查记录'},
        {name:'质量监督工作报告'},
      ]},
      {name:'安全监督', icon:'fa-suitcase', color:'text-green', children:[
        {name:'安全监督请示'},
        {name:'安全监督巡查记录'},
        {name:'安全监督工作报告'},
      ]},
      {name:'其他单位', icon:'fa-file-text-o', color:'text-danger', children:[
        {name:'委托检测合同'},
        {name:'检测报告'},
      ]}
    ]},
    {name:'设计(1)监理(1)施工(2)', archive:[
      {name:'建设单位', icon:'fa-cloud-upload', color:'text-purple', children:[
        {name:'前期工作'},
        {name:'招投标工作'},
        {name:'建设管理'},
        {name:'项目验收'},
      ]},
      {name:'设计单位', icon:'fa-file-text-o', color:'text-info', children:[
        {name:'勘查设计合同'},
        {name:'勘查设计工作大纲'},
        {name:'中标通知书'},
        {name:'地质勘察报告'},
        {name:'设计管理报告'},
        {name:'设计变更文件'},
      ]},
      {name:'监理单位', icon:'fa-exclamation', color:'text-danger', children:[
        {name:'监理合同'},
        {name:'中标通知书'},
        {name:'监理规划'},
        {name:'监理细则'},
        {name:'开工令'},
        {name:'项目划分'},
        {name:'施工图设计交底'},
        {name:'旁站记录'},
        {name:'计量审核'},
        {name:'监理通知书'},
        {name:'监理检查记录'},
        {name:'监理工作报告'},
        {name:'监理指示单'},
        {name:'监理日志'},
        {name:'监理管理工作报告'},
      ]},
      {name:'1标施工单位', icon:'fa-clock-o', color:'text-success', children:[
        {name:'施工合同'},
        {name:'施工准备'},
        {name:'开工令'},
        {name:'设备材料和零部件检验报告'},
        {name:'停工复工'},
        {name:'设计变更'},
        {name:'单元工程质量报验单及评定'},
        {name:'分部工程质量报验及评定'},
        {name:'单位工程评定'},
        {name:'计量证书'},
        {name:'结算资料'},
        {name:'施工日志'},
        {name:'施工管理工作报告'},
        {name:'竣工图'},
      ]},
      {name:'2标施工单位', icon:'fa-clock-o', color:'text-success', children:[
        {name:'施工合同'},
        {name:'施工准备'},
        {name:'开工令'},
        {name:'设备材料和零部件检验报告'},
        {name:'停工复工'},
        {name:'设计变更'},
        {name:'单元工程质量报验单及评定'},
        {name:'分部工程质量报验及评定'},
        {name:'单位工程评定'},
        {name:'计量证书'},
        {name:'结算资料'},
        {name:'施工日志'},
        {name:'施工管理工作报告'},
        {name:'竣工图'},
      ]},
      {name:'质量监督', icon:'fa-trophy', color:'text-pink', children:[
        {name:'质量监督请示'},
        {name:'质量监督巡查记录'},
        {name:'质量监督工作报告'},
      ]},
      {name:'安全监督', icon:'fa-suitcase', color:'text-green', children:[
        {name:'安全监督请示'},
        {name:'安全监督巡查记录'},
        {name:'安全监督工作报告'},
      ]},
      {name:'其他单位', icon:'fa-file-text-o', color:'text-danger', children:[
        {name:'委托检测合同'},
        {name:'检测报告'},
      ]}
    ]}
  ],

  userAreaList : [
    {id:'1', name:'清江浦区'},
    {id:'2', name:'淮阴区'},
    {id:'3', name:'淮安区'},
    {id:'4', name:'洪泽区'},
    {id:'5', name:'涟水县'},
    {id:'6', name:'盱眙县'},
    {id:'7', name:'金湖县'},
    {id:'10000', name:'市局'}
  ],

  projectAreaList : [
    {id:'1', name:'清江浦区'},
    {id:'2', name:'淮阴区'},
    {id:'3', name:'淮安区'},
    {id:'4', name:'洪泽区'},
    {id:'5', name:'涟水县'},
    {id:'6', name:'盱眙县'},
    {id:'7', name:'金湖县'},
    {id:'10000', name:'淮安市'}
  ]
};
