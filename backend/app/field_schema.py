"""Field catalogs and projection rules for Backend B related_entries.

Aligned with repo root ``信息匹配.md``:
  - list card fields → SSE ``fields``
  - detail drawer fields → SSE ``detailFields``
  - platform discovery is multi-section (proof_of_concept_centers / pilot_test_platforms / …)

Backend A decides which keys reach the frontend. Frontend only renders
the field metadata returned in SSE (key + Chinese label).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import (
    ACHIEVEMENT_DISPLAY_FIELDS_RAW,
    DEMAND_DISPLAY_FIELDS_RAW,
    ENTERPRISE_DISPLAY_FIELDS_RAW,
    EXPERT_DISPLAY_FIELDS_RAW,
    PLATFORM_DISPLAY_FIELDS_RAW,
    POLICY_DISPLAY_FIELDS_RAW,
    parse_field_list,
)


@dataclass(frozen=True, slots=True)
class FieldDef:
    key: str
    label: str


# ---------------------------------------------------------------------------
# 1.1 专家发现 expert_team
# ---------------------------------------------------------------------------
EXPERT_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("expert_team_name", "专家团队名称"),
    FieldDef("team_leader", "团队负责人"),
    FieldDef("expertise_areas", "擅长方向"),
    FieldDef("primary_technology_field", "技术领域一级"),
    FieldDef("secondary_technology_field", "技术领域二级"),
    FieldDef("affiliated_university", "所属高校"),
    FieldDef("publisher", "发布人"),
)
EXPERT_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("team_size", "团队人数"),
    FieldDef("team_introduction", "团队介绍"),
    FieldDef("representative_achievements", "代表性成果"),
)
# Full catalog (list + detail) for env projection / debug
EXPERT_FIELD_CATALOG: tuple[FieldDef, ...] = EXPERT_LIST_FIELDS + EXPERT_DETAIL_FIELDS
DEFAULT_EXPERT_KEYS: tuple[str, ...] = tuple(f.key for f in EXPERT_LIST_FIELDS)

# ---------------------------------------------------------------------------
# 1.2 成果发现 achievements
# ---------------------------------------------------------------------------
ACHIEVEMENT_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("achievement_name", "成果名称"),
    FieldDef("achievement_contributors", "成果完成人"),
    FieldDef("primary_technology_field", "技术领域一级"),
    FieldDef("secondary_technology_field", "技术领域二级"),
    FieldDef("maturity_level", "成熟度"),
    FieldDef("commercialization_method", "转化方式"),
    FieldDef("publishing_organization_name", "发布单位"),
)
ACHIEVEMENT_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("achievement_brief", "成果简介"),
    FieldDef("achievement_overview", "成果综述"),
    FieldDef("rights_ownership_type", "权利归属类型"),
    FieldDef("rights_holding_organization_name", "权利归属机构"),
    FieldDef("intended_amount_10k_cny", "意向金额"),
    FieldDef("related_expert_team", "关联专家团队"),
    FieldDef("is_carbon_peaking_neutrality_related", "是否碳达峰碳中和相关"),
    FieldDef("contact_name", "联系人"),
    FieldDef("contact_phone", "联系电话"),
)
ACHIEVEMENT_FIELD_CATALOG: tuple[FieldDef, ...] = (
    ACHIEVEMENT_LIST_FIELDS + ACHIEVEMENT_DETAIL_FIELDS
)
DEFAULT_ACHIEVEMENT_KEYS: tuple[str, ...] = tuple(
    f.key for f in ACHIEVEMENT_LIST_FIELDS
)

# ---------------------------------------------------------------------------
# 1.3 需求发现 requirements
# ---------------------------------------------------------------------------
DEMAND_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("requirement_name", "需求名称"),
    FieldDef("requirement_type", "需求类型"),
    FieldDef("cooperation_method", "合作方式"),
    FieldDef("deadline", "截止日期"),
    FieldDef("primary_technology_field", "技术领域一级"),
    FieldDef("secondary_technology_field", "技术领域二级"),
    FieldDef("nanjing_key_industry_field", "南京重点发展产业领域"),
    FieldDef("affiliated_organization", "所属单位"),
    FieldDef("region", "所属地区"),
    FieldDef("intended_investment_10k_cny", "意向投入金额"),
)
DEMAND_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("requirement_description", "需求描述"),
    FieldDef("existing_foundation", "现有基础"),
    FieldDef("contact_name", "联系人"),
    FieldDef("contact_info", "联系方式"),
    FieldDef("rd_lead_name", "研发负责人"),
    FieldDef("rd_lead_phone", "研发负责人电话"),
)
DEMAND_FIELD_CATALOG: tuple[FieldDef, ...] = DEMAND_LIST_FIELDS + DEMAND_DETAIL_FIELDS
DEFAULT_DEMAND_KEYS: tuple[str, ...] = tuple(f.key for f in DEMAND_LIST_FIELDS)

# ---------------------------------------------------------------------------
# 1.4 企业发现 enterprises
# ---------------------------------------------------------------------------
ENTERPRISE_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("company_name", "企业名称"),
    FieldDef("industry_field", "产业领域"),
    FieldDef("evaluation_grade", "评价等级"),
    FieldDef("qualifications", "资质"),
    FieldDef("registered_capital", "注册资本"),
    FieldDef("establishment_date", "成立日期"),
    FieldDef("district", "所属区"),
)
ENTERPRISE_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("company_introduction", "企业介绍"),
    FieldDef("business_scope", "经营范围"),
    FieldDef("legal_representative", "法定代表人"),
    FieldDef("contact_info", "联系方式"),
    FieldDef("company_website", "企业官网"),
    FieldDef("patent_applications", "专利申请情况"),
    FieldDef("identity", "身份"),
)
ENTERPRISE_FIELD_CATALOG: tuple[FieldDef, ...] = (
    ENTERPRISE_LIST_FIELDS + ENTERPRISE_DETAIL_FIELDS
)
DEFAULT_ENTERPRISE_KEYS: tuple[str, ...] = tuple(
    f.key for f in ENTERPRISE_LIST_FIELDS
)

# ---------------------------------------------------------------------------
# 1.5 平台发现 — multi-section
# ---------------------------------------------------------------------------
POC_CENTER_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("center_name", "名称"),
    FieldDef("responsible_organization", "承担单位"),
    FieldDef("district", "所属区"),
    FieldDef("center_type", "类型"),
    FieldDef("service_field", "服务领域"),
    FieldDef("level", "级别"),
)
POC_CENTER_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("contact_name", "联系人"),
    FieldDef("contact_phone", "联系电话"),
    FieldDef("organization_address", "单位地址"),
    FieldDef("service_content", "服务内容"),
    FieldDef("responsible_organization_introduction", "承担单位简介"),
)

PILOT_TEST_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("platform_name", "平台名称"),
    FieldDef("operating_entity", "运营主体"),
    FieldDef("industry_category", "产业类别"),
)
PILOT_TEST_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("platform_introduction", "平台介绍"),
    FieldDef("service_content", "服务内容"),
    FieldDef("address", "地址"),
    FieldDef("contact_name", "联系人"),
    FieldDef("contact_phone", "联系电话"),
)

EQUIPMENT_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("equipment_name", "仪器设备名称"),
    FieldDef("specification_model", "规格型号"),
    FieldDef("operating_status", "运行状态"),
    FieldDef("managing_organization_name", "管理单位"),
    FieldDef("service_field", "服务领域"),
    FieldDef("service_price", "服务价格"),
    FieldDef("service_price_unit", "服务价格单位"),
)
EQUIPMENT_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("key_technical_specifications", "主要技术指标"),
    FieldDef("main_functions", "主要功能"),
    FieldDef("installation_address", "安放地址"),
    FieldDef("equipment_contact", "仪器联系人"),
    FieldDef("mobile_phone", "联系电话"),
    FieldDef("service_cycle", "服务周期"),
    FieldDef("service_item_product", "服务项目"),
    FieldDef("sample_requirements", "样品要求"),
)

PUBLIC_SERVICE_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("platform_name_required", "平台名称"),
    FieldDef("responsible_organization_required", "承担单位"),
    FieldDef("province_required", "所在省"),
    FieldDef("city_required", "所在市"),
    FieldDef("district_required", "所在区"),
    FieldDef("industry_field_required", "产业领域"),
)
PUBLIC_SERVICE_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("platform_overview_required", "平台概述"),
    FieldDef("platform_functions_required", "平台功能"),
    FieldDef("construction_address_required", "建设地址"),
    FieldDef("contact_name_required", "联系人"),
    FieldDef("contact_info_required", "联系方式"),
)

# Flat fallback catalog (legacy single-list platforms)
PLATFORM_LIST_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("platform_name", "平台名称"),
    FieldDef("organization", "依托单位"),
    FieldDef("brief", "平台简介"),
)
PLATFORM_DETAIL_FIELDS: tuple[FieldDef, ...] = (
    FieldDef("contact_name", "联系人"),
    FieldDef("contact_phone", "联系电话"),
    FieldDef("service_content", "服务内容"),
)
PLATFORM_FIELD_CATALOG: tuple[FieldDef, ...] = (
    PLATFORM_LIST_FIELDS
    + PLATFORM_DETAIL_FIELDS
    + POC_CENTER_LIST_FIELDS
    + POC_CENTER_DETAIL_FIELDS
    + PILOT_TEST_LIST_FIELDS
    + PILOT_TEST_DETAIL_FIELDS
    + EQUIPMENT_LIST_FIELDS
    + EQUIPMENT_DETAIL_FIELDS
    + PUBLIC_SERVICE_LIST_FIELDS
    + PUBLIC_SERVICE_DETAIL_FIELDS
)
DEFAULT_PLATFORM_KEYS: tuple[str, ...] = tuple(f.key for f in PLATFORM_LIST_FIELDS)

# Ordered platform sections: only non-empty ones are emitted to the frontend.
# Primary keys match Backend B related_entries; aliases keep older docs/samples working.
PLATFORM_SECTION_DEFS: tuple[
    tuple[str, str, tuple[FieldDef, ...], tuple[FieldDef, ...], tuple[str, ...]], ...
] = (
    (
        "proof_of_concept_centers",
        "概念验证中心",
        POC_CENTER_LIST_FIELDS,
        POC_CENTER_DETAIL_FIELDS,
        ("poc_center",),
    ),
    (
        "pilot_test_platforms",
        "中试平台",
        PILOT_TEST_LIST_FIELDS,
        PILOT_TEST_DETAIL_FIELDS,
        ("pilot_test_platform",),
    ),
    (
        "large_equipment",
        "大型仪器设备",
        EQUIPMENT_LIST_FIELDS,
        EQUIPMENT_DETAIL_FIELDS,
        ("large_scale_equipment",),
    ),
    (
        "public_service_platforms",
        "公共服务平台",
        PUBLIC_SERVICE_LIST_FIELDS,
        PUBLIC_SERVICE_DETAIL_FIELDS,
        ("public_service_platform",),
    ),
)

# ---------------------------------------------------------------------------
# Policy (unchanged placeholder)
# ---------------------------------------------------------------------------
POLICY_FIELD_CATALOG: tuple[FieldDef, ...] = (
    FieldDef("serial_no", "序号"),
    FieldDef("policy_name", "政策名称"),
    FieldDef("level", "政策层级"),
    FieldDef("brief", "政策摘要"),
)
DEFAULT_POLICY_KEYS: tuple[str, ...] = (
    "serial_no",
    "policy_name",
    "level",
    "brief",
)
POLICY_LIST_FIELDS: tuple[FieldDef, ...] = POLICY_FIELD_CATALOG
POLICY_DETAIL_FIELDS: tuple[FieldDef, ...] = ()

# Frontend agentKey → Backend B ``function`` query param
AGENT_FUNCTION_MAP: dict[str, str] = {
    "achievement_discover": "achievements",
    "expert_discover": "expert_team",
    "demand_discover": "requirements",
    "enterprise_discover": "enterprises",
    "platform_discover": "platforms",
    "policy_recommend": "policies",
    "achievement_eval": "achievement_eval",
    "research_direction": "research_direction",
}

# function → list key aliases that may appear in upstream payload
_FUNCTION_LIST_ALIASES: dict[str, tuple[str, ...]] = {
    "achievements": ("achievements", "items", "entries", "list"),
    "expert_team": ("expert_team", "experts", "items", "entries", "list"),
    "requirements": ("requirements", "demands", "items", "entries", "list"),
    "enterprises": ("enterprises", "items", "entries", "list"),
    "platforms": ("platforms", "items", "entries", "list"),
    "policies": ("policies", "items", "entries", "list"),
}

# function → (primary list key, list fields, detail fields, env override, default list keys)
_FUNCTION_SCHEMA: dict[
    str,
    tuple[
        str,
        tuple[FieldDef, ...],
        tuple[FieldDef, ...],
        str | None,
        tuple[str, ...],
    ],
] = {
    "achievements": (
        "achievements",
        ACHIEVEMENT_LIST_FIELDS,
        ACHIEVEMENT_DETAIL_FIELDS,
        ACHIEVEMENT_DISPLAY_FIELDS_RAW or None,
        DEFAULT_ACHIEVEMENT_KEYS,
    ),
    "expert_team": (
        "expert_team",
        EXPERT_LIST_FIELDS,
        EXPERT_DETAIL_FIELDS,
        EXPERT_DISPLAY_FIELDS_RAW or None,
        DEFAULT_EXPERT_KEYS,
    ),
    "requirements": (
        "requirements",
        DEMAND_LIST_FIELDS,
        DEMAND_DETAIL_FIELDS,
        DEMAND_DISPLAY_FIELDS_RAW or None,
        DEFAULT_DEMAND_KEYS,
    ),
    "enterprises": (
        "enterprises",
        ENTERPRISE_LIST_FIELDS,
        ENTERPRISE_DETAIL_FIELDS,
        ENTERPRISE_DISPLAY_FIELDS_RAW or None,
        DEFAULT_ENTERPRISE_KEYS,
    ),
    "platforms": (
        "platforms",
        PLATFORM_LIST_FIELDS,
        PLATFORM_DETAIL_FIELDS,
        PLATFORM_DISPLAY_FIELDS_RAW or None,
        DEFAULT_PLATFORM_KEYS,
    ),
    "policies": (
        "policies",
        POLICY_LIST_FIELDS,
        POLICY_DETAIL_FIELDS,
        POLICY_DISPLAY_FIELDS_RAW or None,
        DEFAULT_POLICY_KEYS,
    ),
}


def resolve_function(agent_key: str | None) -> str | None:
    """Map frontend scene key to Backend B function param."""

    if not agent_key or agent_key in ("general",):
        return None
    return AGENT_FUNCTION_MAP.get(agent_key)


def _is_object_list(value: Any) -> bool:
    return isinstance(value, list) and any(isinstance(item, dict) for item in value)


def _list_has_serial_no(value: Any) -> bool:
    """True when value is a non-empty object list and any row has ``serial_no``."""

    if not isinstance(value, list) or not value:
        return False
    for item in value:
        if isinstance(item, dict) and "serial_no" in item:
            return True
    return False


def _find_serial_no_list(payload: dict[str, Any]) -> tuple[str, list[Any]] | None:
    """Locate the first row list that carries ``serial_no`` (any domain key)."""

    meta_keys = {
        "fields",
        "detailFields",
        "sections",
        "categories",
        "listKey",
        "intent",
        "function",
    }
    preferred = (
        "items",
        "achievements",
        "expert_team",
        "experts",
        "requirements",
        "demands",
        "enterprises",
        "policies",
        "platforms",
        "entries",
        "list",
        *platform_section_keys(),
    )
    seen: set[str] = set()
    for key in preferred:
        if not key or key in seen:
            continue
        seen.add(key)
        candidate = payload.get(key)
        if _list_has_serial_no(candidate):
            return key, candidate  # type: ignore[return-value]

    for key, value in payload.items():
        if key in meta_keys or key in seen:
            continue
        if _list_has_serial_no(value):
            return str(key), value  # type: ignore[return-value]
    return None


def _function_from_category(raw: Any) -> str | None:
    """Map intent/categories token to a known function schema key."""

    if not isinstance(raw, str):
        return None
    token = raw.strip().lower()
    if not token:
        return None
    aliases = {
        "achievements": "achievements",
        "achievement": "achievements",
        "expert_team": "expert_team",
        "experts": "expert_team",
        "expert": "expert_team",
        "requirements": "requirements",
        "requirement": "requirements",
        "demands": "requirements",
        "demand": "requirements",
        "enterprises": "enterprises",
        "enterprise": "enterprises",
        "policies": "policies",
        "policy": "policies",
        "platforms": "platforms",
        "platform": "platforms",
    }
    mapped = aliases.get(token)
    if mapped and mapped in _FUNCTION_SCHEMA:
        return mapped
    if token in _FUNCTION_SCHEMA:
        return token
    return None


def _function_from_row_keys(keys: set[str]) -> str | None:
    if keys & {
        "achievement_name",
        "achievement_id",
        "technology_maturity",
    }:
        return "achievements"
    if keys & {"expert_team_name", "team_leader", "expertise_areas"}:
        return "expert_team"
    if keys & {
        "requirement_name",
        "demand_name",
        "requirement_id",
        "requirement_type",
        "intended_investment_10k_cny",
    }:
        return "requirements"
    if keys & {"enterprise_name", "enterprise_id", "company_name"}:
        return "enterprises"
    if keys & {"policy_name", "policy_title", "policy_id"}:
        return "policies"
    if keys & {
        "platform_name",
        "platform_name_required",
        "poc_center_name",
        "equipment_name",
        "center_name",
    }:
        return "platforms"
    return None


def infer_function_from_payload(payload: dict[str, Any]) -> str | None:
    """Guess schema function from related_entries keys when agentKey is absent.

    Order prefers domain-specific keys over generic ``items``/``entries``/``list``.
    Also accepts ``categories`` / ``intent`` from upstream intent_classify.
    Multi-section platform maps resolve to ``platforms``.
    """

    # Multi-section platform payload (no single platforms[] array required)
    platform_keys = set(platform_section_keys())
    if any(_is_object_list(payload.get(key)) for key in platform_keys):
        return "platforms"

    # Domain list keys / aliases → function (first hit wins)
    probe_order: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("achievements", ("achievements",)),
        ("expert_team", ("expert_team", "experts")),
        ("requirements", ("requirements", "demands")),
        ("enterprises", ("enterprises",)),
        ("policies", ("policies",)),
        ("platforms", ("platforms",)),
    )
    for function, keys in probe_order:
        for key in keys:
            if _is_object_list(payload.get(key)):
                return function

    # intent_classify may attach categories / intent without a listKey
    for cat in payload.get("categories") or ():
        mapped = _function_from_category(cat)
        if mapped:
            return mapped
    mapped_intent = _function_from_category(payload.get("intent"))
    if mapped_intent:
        return mapped_intent
    mapped_function = _function_from_category(payload.get("function"))
    if mapped_function:
        return mapped_function

    # Generic / domain lists: sniff row shape via known primary name fields
    for probe_key in (
        "items",
        "entries",
        "list",
        "achievements",
        "expert_team",
        "experts",
        "requirements",
        "demands",
        "enterprises",
        "policies",
        "platforms",
    ):
        rows = payload.get(probe_key)
        if not _is_object_list(rows):
            continue
        sample = next((row for row in rows if isinstance(row, dict)), None)
        if not sample:
            continue
        sniffed = _function_from_row_keys(set(sample.keys()))
        if sniffed:
            return sniffed
        if probe_key in ("items", "entries", "list"):
            return None

    return None


def _catalog_map(catalog: tuple[FieldDef, ...]) -> dict[str, str]:
    return {item.key: item.label for item in catalog}


def _fields_to_dicts(fields: tuple[FieldDef, ...]) -> list[dict[str, str]]:
    return [{"key": f.key, "label": f.label} for f in fields]


def _select_list_fields(
    list_fields: tuple[FieldDef, ...],
    raw_override: str | None,
    defaults: tuple[str, ...],
) -> list[dict[str, str]]:
    """Return ordered list-card fields; env override may narrow/reorder list keys."""

    labels = _catalog_map(list_fields)
    keys = parse_field_list(raw_override or "") or list(defaults)
    seen: set[str] = set()
    ordered: list[str] = []
    for key in keys:
        if key in labels and key not in seen:
            seen.add(key)
            ordered.append(key)
    if not ordered:
        ordered = [k for k in defaults if k in labels]
    return [{"key": k, "label": labels[k]} for k in ordered]


def selected_fields(function: str | None) -> list[dict[str, str]]:
    """Return ordered list-card ``[{key, label}, ...]`` for the given function.

    For platforms, returns a flat union of section list fields (debug/meta).
    """

    if not function or function not in _FUNCTION_SCHEMA:
        return []

    if function == "platforms":
        # Meta/debug: all section list fields in document order
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        for _key, _label, list_fields, _detail, *_rest in PLATFORM_SECTION_DEFS:
            for f in list_fields:
                if f.key not in seen:
                    seen.add(f.key)
                    out.append({"key": f.key, "label": f.label})
        return out

    _list_key, list_fields, _detail, raw_override, defaults = _FUNCTION_SCHEMA[function]
    return _select_list_fields(list_fields, raw_override, defaults)


def selected_detail_fields(function: str | None) -> list[dict[str, str]]:
    """Return ordered detail-drawer fields for a single-list function."""

    if not function or function not in _FUNCTION_SCHEMA:
        return []
    if function == "platforms":
        return []
    _list_key, _list_fields, detail_fields, _raw, _defaults = _FUNCTION_SCHEMA[function]
    return _fields_to_dicts(detail_fields)


# Always keep relevance score on each row (not a list-card / detail field).
_ROW_PASSTHROUGH_KEYS: tuple[str, ...] = ("score", "serial_no")


def _row_field_value(row: dict[str, Any], key: str) -> Any:
    """Read a row field; accept both plain and ``*_required`` key forms.

    Backend B often returns public-service rows as ``platform_name`` while the
    catalog / knowledge-base schema uses ``platform_name_required``. Without
    this bridge, projection fills empty strings and the UI falls back to
    「条目 N」 titles with blank cells.
    """
    if key in row:
        value = row[key]
        if value is not None and value != "":
            return value
    if key.endswith("_required"):
        alt = key[: -len("_required")]
        if alt in row:
            return row[alt]
    else:
        alt = f"{key}_required"
        if alt in row:
            return row[alt]
    return row.get(key, "")


def _project_rows(
    raw_items: list[Any],
    field_keys: list[str],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in raw_items:
        if not isinstance(row, dict):
            continue
        if field_keys:
            projected = {k: _row_field_value(row, k) for k in field_keys}
            for key in _ROW_PASSTHROUGH_KEYS:
                if key in row and key not in projected:
                    projected[key] = row[key]
            items.append(projected)
        else:
            items.append(dict(row))
    return items


def _extract_list(
    payload: dict[str, Any],
    primary_key: str,
    aliases: tuple[str, ...],
) -> tuple[str, list[Any]]:
    raw = payload.get(primary_key)
    if isinstance(raw, list):
        return primary_key, raw
    for alias in aliases:
        if alias == primary_key:
            continue
        candidate = payload.get(alias)
        if isinstance(candidate, list):
            return alias, candidate
    return primary_key, []


def _project_platform_sections(payload: dict[str, Any]) -> dict[str, Any]:
    """Project multi-type platform payload into ordered non-empty sections.

    Upstream may return any subset of::

        {
          "proof_of_concept_centers": [...],
          "pilot_test_platforms": [...],
          "large_equipment": [...],
          "public_service_platforms": [...]
        }

    Older singular keys (poc_center / pilot_test_platform / …) are still accepted.
    Fallback: a flat ``platforms`` / ``items`` list uses generic platform fields.
    """

    sections: list[dict[str, Any]] = []
    flat_items: list[dict[str, Any]] = []

    for (
        section_key,
        section_label,
        list_fields,
        detail_fields,
        aliases,
    ) in PLATFORM_SECTION_DEFS:
        raw = payload.get(section_key)
        if not isinstance(raw, list) or not raw:
            for alias in aliases:
                candidate = payload.get(alias)
                if isinstance(candidate, list) and candidate:
                    raw = candidate
                    break
        if not isinstance(raw, list) or not raw:
            continue
        list_dicts = _fields_to_dicts(list_fields)
        detail_dicts = _fields_to_dicts(detail_fields)
        keys = [f["key"] for f in list_dicts] + [f["key"] for f in detail_dicts]
        # de-dupe keys while preserving order
        seen: set[str] = set()
        field_keys: list[str] = []
        for k in keys:
            if k not in seen:
                seen.add(k)
                field_keys.append(k)
        items = _project_rows(raw, field_keys)
        if not items:
            continue
        sections.append(
            {
                "key": section_key,
                "label": section_label,
                "fields": list_dicts,
                "detailFields": detail_dicts,
                "items": items,
            }
        )
        flat_items.extend(items)

    if sections:
        # Prefer first section's fields as top-level meta for simple clients
        first = sections[0]
        return {
            "listKey": "platforms",
            "fields": first["fields"],
            "detailFields": first["detailFields"],
            "items": flat_items,
            "sections": sections,
            **{s["key"]: s["items"] for s in sections},
        }

    # Flat fallback (legacy single platforms list)
    list_key, raw_items = _extract_list(
        payload, "platforms", _FUNCTION_LIST_ALIASES["platforms"]
    )
    list_dicts = _select_list_fields(
        PLATFORM_LIST_FIELDS,
        PLATFORM_DISPLAY_FIELDS_RAW or None,
        DEFAULT_PLATFORM_KEYS,
    )
    detail_dicts = _fields_to_dicts(PLATFORM_DETAIL_FIELDS)
    field_keys = [f["key"] for f in list_dicts] + [f["key"] for f in detail_dicts]
    items = _project_rows(raw_items if isinstance(raw_items, list) else [], field_keys)
    return {
        "listKey": list_key,
        "fields": list_dicts,
        "detailFields": detail_dicts,
        "items": items,
        "sections": [],
        list_key: items,
    }


def _project_generic_related_entries(payload: dict[str, Any]) -> dict[str, Any]:
    """Best-effort projection when no function schema can be resolved.

    Prefers any list whose rows include ``serial_no`` (upstream marker for
    related entries). Falls back to the first non-empty object list.
    """

    found = _find_serial_no_list(payload)
    if found:
        resolved_key, raw_items = found
    else:
        preferred_keys = (
            "achievements",
            "expert_team",
            "experts",
            "requirements",
            "demands",
            "enterprises",
            "policies",
            "platforms",
            "items",
            "entries",
            "list",
            *platform_section_keys(),
        )
        resolved_key = "items"
        raw_items: list[Any] = []
        seen: set[str] = set()
        for key in preferred_keys:
            if not key or key in seen:
                continue
            seen.add(key)
            candidate = payload.get(key)
            if _is_object_list(candidate):
                resolved_key = key
                raw_items = candidate  # type: ignore[assignment]
                break

        if not raw_items:
            for key, value in payload.items():
                if key in seen:
                    continue
                if _is_object_list(value):
                    resolved_key = str(key)
                    raw_items = value  # type: ignore[assignment]
                    break

    # Keep full rows; no schema means no field filtering / labels.
    items = [dict(row) for row in raw_items if isinstance(row, dict)]
    return {
        "listKey": resolved_key,
        "fields": [],
        "detailFields": [],
        "items": items,
        "sections": [],
        resolved_key: items,
    }


def project_related_entries(
    function: str | None,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Filter Backend B related_entries down to configured list + detail fields.

    Returns a frontend-friendly payload::

        {
          "listKey": "achievements",
          "fields": [{"key": "...", "label": "..."}],       # list card
          "detailFields": [{"key": "...", "label": "..."}], # detail drawer
          "items": [{... list + detail keys ...}],
          "sections": [...]  # only for multi-type platforms (may be empty)
        }

    When ``function`` is missing (general chat / no agentKey), infers schema from
    payload keys so domain lists still project into ``items`` + field metadata.
    """

    resolved_function = function
    if not resolved_function or resolved_function not in _FUNCTION_SCHEMA:
        resolved_function = infer_function_from_payload(payload)

    # serial_no marks related rows under any key (items empty or domain key)
    serial_hit = _find_serial_no_list(payload)
    if serial_hit and (
        not resolved_function or resolved_function not in _FUNCTION_SCHEMA
    ):
        # Try sniffing function from the serial_no list itself
        serial_key, serial_rows = serial_hit
        sample = next((row for row in serial_rows if isinstance(row, dict)), None)
        if sample:
            sniffed = _function_from_row_keys(set(sample.keys()))
            if sniffed:
                resolved_function = sniffed
            elif not resolved_function:
                resolved_function = _function_from_category(serial_key)

    if resolved_function == "platforms":
        return _project_platform_sections(payload)

    if not resolved_function or resolved_function not in _FUNCTION_SCHEMA:
        return _project_generic_related_entries(payload)

    list_key, list_fields, detail_fields, raw_override, defaults = _FUNCTION_SCHEMA[
        resolved_function
    ]
    list_dicts = _select_list_fields(list_fields, raw_override, defaults)
    detail_dicts = _fields_to_dicts(detail_fields)
    field_keys = [f["key"] for f in list_dicts] + [f["key"] for f in detail_dicts]
    # de-dupe
    seen_keys: set[str] = set()
    unique_keys: list[str] = []
    for k in field_keys:
        if k not in seen_keys:
            seen_keys.add(k)
            unique_keys.append(k)

    aliases = _FUNCTION_LIST_ALIASES.get(
        resolved_function, ("items", "entries", "list")
    )
    resolved_key, raw_items = _extract_list(payload, list_key, aliases)

    # If schema extract missed but serial_no list exists, use that list
    if not raw_items and serial_hit:
        resolved_key, raw_items = serial_hit

    items = _project_rows(raw_items, unique_keys)

    return {
        "listKey": resolved_key,
        "fields": list_dicts,
        "detailFields": detail_dicts,
        "items": items,
        "sections": [],
        resolved_key: items,
    }


def platform_section_keys() -> tuple[str, ...]:
    """Keys that count as related list data for platform discovery."""

    keys: list[str] = []
    for entry in PLATFORM_SECTION_DEFS:
        # (primary, label, list_fields, detail_fields, aliases)
        primary = entry[0]
        aliases = entry[-1] if isinstance(entry[-1], tuple) else ()
        keys.append(primary)
        keys.extend(aliases)
    # Keep a hard-coded safety net in case defs unpacking drifts.
    keys.extend(
        [
            "proof_of_concept_centers",
            "pilot_test_platforms",
            "large_equipment",
            "public_service_platforms",
            "poc_center",
            "pilot_test_platform",
            "large_scale_equipment",
            "public_service_platform",
        ]
    )
    # de-dupe, preserve order
    seen: set[str] = set()
    ordered: list[str] = []
    for key in keys:
        if key and key not in seen:
            seen.add(key)
            ordered.append(key)
    return tuple(ordered)
