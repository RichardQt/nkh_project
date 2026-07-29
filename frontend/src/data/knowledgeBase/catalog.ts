/** Knowledge base catalog metadata. */

export type KbColumnDef = {
  key: string;
  title: string;
  ellipsis?: boolean;
  longText?: boolean;
};

export type KbLibraryMeta = {
  key: string;
  label: string;
  primaryField: string;
  columns: KbColumnDef[];
};

export const KB_LIBRARIES: KbLibraryMeta[] = [
  {
    "key": "achievements",
    "label": "成果库",
    "primaryField": "achievement_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "achievement_name",
        "title": "成果名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "achievement_contributors",
        "title": "成果完成人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "research_team_leader_type",
        "title": "科研团队负责人类型",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "primary_technology_field",
        "title": "一级技术领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "secondary_technology_field",
        "title": "二级技术领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "nanjing_key_industry_field",
        "title": "南京市重点产业领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "commercialization_method",
        "title": "转化方式",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "maturity_level",
        "title": "成熟度",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "achievement_ownership",
        "title": "成果权属",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "rights_ownership_type",
        "title": "权属类型",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "individual_name",
        "title": "个人姓名",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "individual_id_number",
        "title": "个人证件号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "rights_holding_organization_name",
        "title": "权属机构名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "intended_amount_10k_cny",
        "title": "意向金额(万元)",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "achievement_brief",
        "title": "成果简介",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "achievement_overview",
        "title": "成果概述",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "publishing_organization_name",
        "title": "发布机构",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_name",
        "title": "联系人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_phone",
        "title": "联系电话",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "related_expert_team",
        "title": "关联专家团队",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "is_carbon_peaking_neutrality_related",
        "title": "是否双碳相关",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "review_time",
        "title": "审核时间",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "requirements",
    "label": "需求库",
    "primaryField": "requirement_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "requirement_name",
        "title": "需求名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "requirement_type",
        "title": "需求类型",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "cooperation_method",
        "title": "合作方式",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "deadline",
        "title": "截止时间",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_name",
        "title": "联系人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_info",
        "title": "联系方式",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "organization_name",
        "title": "机构名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "rd_lead_name",
        "title": "研发负责人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "rd_lead_phone",
        "title": "研发负责人电话",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "affiliated_organization",
        "title": "所属机构",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "region",
        "title": "所属区域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "is_carbon_peaking_related",
        "title": "是否双碳相关",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "is_public",
        "title": "是否公开",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "primary_technology_field",
        "title": "一级技术领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "secondary_technology_field",
        "title": "二级技术领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "nanjing_key_industry_field",
        "title": "南京市重点产业领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "intended_investment_10k_cny",
        "title": "意向投资(万元)",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "requirement_description",
        "title": "需求描述",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "existing_foundation",
        "title": "已有基础",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "review_time",
        "title": "审核时间",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "expert_team",
    "label": "专家团队库",
    "primaryField": "expert_team_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "expert_team_name",
        "title": "专家团队名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "team_leader",
        "title": "团队负责人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "team_size",
        "title": "团队规模",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "team_introduction",
        "title": "团队简介",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "expertise_areas",
        "title": "擅长领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "primary_technology_field",
        "title": "一级技术领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "secondary_technology_field",
        "title": "二级技术领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "affiliated_university",
        "title": "所属高校",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "representative_achievements",
        "title": "代表性成果",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "publisher",
        "title": "发布方",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "enterprises",
    "label": "企业库",
    "primaryField": "company_name",
    "columns": [
      {
        "key": "company_name",
        "title": "企业名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "qualifications",
        "title": "资质",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "unified_social_credit_code",
        "title": "统一社会信用代码",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "evaluation_grade",
        "title": "评价等级",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "industry_field",
        "title": "产业领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "industry_chain_segment",
        "title": "产业链环节",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "legal_representative",
        "title": "法定代表人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "registered_capital",
        "title": "注册资本",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "establishment_date",
        "title": "成立日期",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "district",
        "title": "所属区",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_info",
        "title": "联系方式",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "address",
        "title": "地址",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "company_website",
        "title": "企业网站",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "company_introduction",
        "title": "企业简介",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "business_scope",
        "title": "经营范围",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "identity",
        "title": "身份标识",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "patent_applications",
        "title": "专利申请",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "poc_center",
    "label": "概念验证中心库",
    "primaryField": "center_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "center_name",
        "title": "中心名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "responsible_organization",
        "title": "责任单位",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "district",
        "title": "所属区",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "center_type",
        "title": "中心类型",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_field",
        "title": "服务领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "level",
        "title": "级别",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_name",
        "title": "联系人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_phone",
        "title": "联系电话",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "organization_address",
        "title": "单位地址",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_content",
        "title": "服务内容",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "responsible_organization_introduction",
        "title": "责任单位简介",
        "ellipsis": true,
        "longText": true
      }
    ]
  },
  {
    "key": "pilot_test_platform",
    "label": "中试平台库",
    "primaryField": "platform_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "platform_name",
        "title": "平台名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "operating_entity",
        "title": "运营主体",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "platform_introduction",
        "title": "平台简介",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "industry_category",
        "title": "产业类别",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_content",
        "title": "服务内容",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "address",
        "title": "地址",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_name",
        "title": "联系人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_phone",
        "title": "联系电话",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "large_scale_equipment",
    "label": "大型仪器设备库",
    "primaryField": "equipment_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "equipment_name",
        "title": "设备名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "specification_model",
        "title": "规格型号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "operating_status",
        "title": "运行状态",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "manufacturer",
        "title": "生产厂家",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "key_technical_specifications",
        "title": "关键技术指标",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "main_functions",
        "title": "主要功能",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "managing_organization_name",
        "title": "管理单位",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "internal_department",
        "title": "内部部门",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "installation_address",
        "title": "安装地址",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "equipment_contact",
        "title": "设备联系人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "landline_phone",
        "title": "固定电话",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "mobile_phone",
        "title": "手机",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_field",
        "title": "服务领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_price",
        "title": "服务价格",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_price_unit",
        "title": "价格单位",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "other_service_price",
        "title": "其他服务价格",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_cycle",
        "title": "服务周期",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "service_item_product",
        "title": "服务项目/产品",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "sample_requirements",
        "title": "样品要求",
        "ellipsis": true,
        "longText": true
      }
    ]
  },
  {
    "key": "public_service_platform",
    "label": "公共服务平台库",
    "primaryField": "platform_name_required",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "platform_name_required",
        "title": "平台名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "platform_overview_required",
        "title": "平台概况",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "responsible_organization_required",
        "title": "责任单位",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "province_required",
        "title": "省",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "city_required",
        "title": "市",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "district_required",
        "title": "区",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "construction_address_required",
        "title": "建设地址",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "platform_functions_required",
        "title": "平台功能",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "industry_field_required",
        "title": "产业领域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_name_required",
        "title": "联系人",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "contact_info_required",
        "title": "联系方式",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "provincial_policies",
    "label": "省级政策库",
    "primaryField": "item_name",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "organizing_organization",
        "title": "组织单位",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "level",
        "title": "级别",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "item_name",
        "title": "事项名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "item_category",
        "title": "事项类别",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "item_category_description",
        "title": "事项类别说明",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "project_name",
        "title": "项目名称",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "project_description",
        "title": "项目说明",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "funding_amount",
        "title": "资助金额",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "application_requirements",
        "title": "申报要求",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "application_channel",
        "title": "申报渠道",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "application_url",
        "title": "申报链接",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "related_policy_document_name",
        "title": "相关政策文件",
        "ellipsis": true,
        "longText": false
      }
    ]
  },
  {
    "key": "municipal_policies",
    "label": "市级政策库",
    "primaryField": "policy_category",
    "columns": [
      {
        "key": "serial_no",
        "title": "序号",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "policy_category",
        "title": "政策类别",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "supported_region",
        "title": "支持区域",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "supported_entities",
        "title": "支持对象",
        "ellipsis": true,
        "longText": false
      },
      {
        "key": "support_content",
        "title": "支持内容",
        "ellipsis": true,
        "longText": true
      },
      {
        "key": "source_document",
        "title": "来源文件",
        "ellipsis": true,
        "longText": false
      }
    ]
  }
];

export const DEFAULT_KB_KEY = KB_LIBRARIES[0]?.key ?? "achievements";

export function getKbLibrary(key: string): KbLibraryMeta | undefined {
  return KB_LIBRARIES.find((lib) => lib.key === key);
}
