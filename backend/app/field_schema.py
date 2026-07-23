"""Field catalogs and projection rules for Backend B related_entries.

Backend A decides which keys reach the frontend. Frontend only renders
the ``fields`` list returned in SSE (key + Chinese label).
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


# Full catalog for achievements (Backend B related_entries.achievements[*])
ACHIEVEMENT_FIELD_CATALOG: tuple[FieldDef, ...] = (
    FieldDef("serial_no", "序号"),
    FieldDef("achievement_name", "成果名称"),
    FieldDef("achievement_contributors", "成果完成人"),
    FieldDef("research_team_leader_type", "研发团队负责人类型"),
    FieldDef("primary_technology_field", "一级技术领域"),
    FieldDef("secondary_technology_field", "二级技术领域"),
    FieldDef("nanjing_key_industry_field", "南京市重点产业领域"),
    FieldDef("commercialization_method", "转化方式"),
    FieldDef("maturity_level", "成熟度"),
    FieldDef("achievement_ownership", "成果权属"),
    FieldDef("rights_ownership_type", "知识产权权属类型"),
    FieldDef("individual_name", "个人姓名"),
    FieldDef("individual_id_number", "个人身份证号"),
    FieldDef("rights_holding_organization_name", "权利持有机构名称"),
    FieldDef("intended_amount_10k_cny", "意向金额(万元)"),
    FieldDef("achievement_brief", "成果简介"),
    FieldDef("achievement_overview", "成果概述"),
    FieldDef("publishing_organization_name", "发布机构名称"),
    FieldDef("contact_name", "联系人"),
    FieldDef("contact_phone", "联系电话"),
    FieldDef("related_expert_team", "相关专家团队"),
    FieldDef("is_carbon_peaking_neutrality_related", "是否双碳相关"),
    FieldDef("review_time", "审核时间"),
)

# Sensible default: identity + core summary fields (override via env).
DEFAULT_ACHIEVEMENT_KEYS: tuple[str, ...] = (
    "serial_no",
    "achievement_name",
    "achievement_contributors",
    "primary_technology_field",
    "maturity_level",
    "achievement_brief",
    "publishing_organization_name",
    "contact_name",
)

# Placeholder catalogs for other discovery scenes (extend when B contracts land).
EXPERT_FIELD_CATALOG: tuple[FieldDef, ...] = (
    FieldDef("serial_no", "序号"),
    FieldDef("expert_name", "专家姓名"),
    FieldDef("title", "职称"),
    FieldDef("organization", "所属机构"),
    FieldDef("research_field", "研究方向"),
    FieldDef("brief", "简介"),
)
DEFAULT_EXPERT_KEYS: tuple[str, ...] = (
    "serial_no",
    "expert_name",
    "organization",
    "research_field",
)

DEMAND_FIELD_CATALOG: tuple[FieldDef, ...] = (
    FieldDef("serial_no", "序号"),
    FieldDef("demand_name", "需求名称"),
    FieldDef("industry", "所属行业"),
    FieldDef("organization", "发布单位"),
    FieldDef("brief", "需求简介"),
)
DEFAULT_DEMAND_KEYS: tuple[str, ...] = (
    "serial_no",
    "demand_name",
    "industry",
    "brief",
)

ENTERPRISE_FIELD_CATALOG: tuple[FieldDef, ...] = (
    FieldDef("serial_no", "序号"),
    FieldDef("enterprise_name", "企业名称"),
    FieldDef("industry", "所属行业"),
    FieldDef("brief", "企业简介"),
)
DEFAULT_ENTERPRISE_KEYS: tuple[str, ...] = (
    "serial_no",
    "enterprise_name",
    "industry",
    "brief",
)

PLATFORM_FIELD_CATALOG: tuple[FieldDef, ...] = (
    FieldDef("serial_no", "序号"),
    FieldDef("platform_name", "平台名称"),
    FieldDef("organization", "依托单位"),
    FieldDef("brief", "平台简介"),
)
DEFAULT_PLATFORM_KEYS: tuple[str, ...] = (
    "serial_no",
    "platform_name",
    "organization",
    "brief",
)

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

# Frontend agentKey → Backend B ``function`` query param
AGENT_FUNCTION_MAP: dict[str, str] = {
    "achievement_discover": "achievements",
    "expert_discover": "experts",
    "demand_discover": "demands",
    "enterprise_discover": "enterprises",
    "platform_discover": "platforms",
    "policy_recommend": "policies",
    "achievement_eval": "achievement_eval",
    "research_direction": "research_direction",
}

# function → (list key in related_entries payload, catalog, env override, defaults)
_FUNCTION_SCHEMA: dict[str, tuple[str, tuple[FieldDef, ...], str | None, tuple[str, ...]]] = {
    "achievements": (
        "achievements",
        ACHIEVEMENT_FIELD_CATALOG,
        ACHIEVEMENT_DISPLAY_FIELDS_RAW or None,
        DEFAULT_ACHIEVEMENT_KEYS,
    ),
    "experts": (
        "experts",
        EXPERT_FIELD_CATALOG,
        EXPERT_DISPLAY_FIELDS_RAW or None,
        DEFAULT_EXPERT_KEYS,
    ),
    "demands": (
        "demands",
        DEMAND_FIELD_CATALOG,
        DEMAND_DISPLAY_FIELDS_RAW or None,
        DEFAULT_DEMAND_KEYS,
    ),
    "enterprises": (
        "enterprises",
        ENTERPRISE_FIELD_CATALOG,
        ENTERPRISE_DISPLAY_FIELDS_RAW or None,
        DEFAULT_ENTERPRISE_KEYS,
    ),
    "platforms": (
        "platforms",
        PLATFORM_FIELD_CATALOG,
        PLATFORM_DISPLAY_FIELDS_RAW or None,
        DEFAULT_PLATFORM_KEYS,
    ),
    "policies": (
        "policies",
        POLICY_FIELD_CATALOG,
        POLICY_DISPLAY_FIELDS_RAW or None,
        DEFAULT_POLICY_KEYS,
    ),
}


def resolve_function(agent_key: str | None) -> str | None:
    """Map frontend scene key to Backend B function param."""

    if not agent_key or agent_key in ("general",):
        return None
    return AGENT_FUNCTION_MAP.get(agent_key)


def _catalog_map(catalog: tuple[FieldDef, ...]) -> dict[str, str]:
    return {item.key: item.label for item in catalog}


def selected_fields(function: str | None) -> list[dict[str, str]]:
    """Return ordered ``[{key, label}, ...]`` for the given function."""

    if not function or function not in _FUNCTION_SCHEMA:
        return []

    _list_key, catalog, raw_override, defaults = _FUNCTION_SCHEMA[function]
    labels = _catalog_map(catalog)
    known_order = [f.key for f in catalog]

    keys = parse_field_list(raw_override or "") or list(defaults)
    # Keep order, drop unknown keys, de-dupe
    seen: set[str] = set()
    ordered: list[str] = []
    for key in keys:
        if key in labels and key not in seen:
            seen.add(key)
            ordered.append(key)
    # If env listed only unknown keys, fall back to defaults
    if not ordered:
        ordered = [k for k in defaults if k in labels]

    # Prefer catalog order for keys that appear in defaults subset? keep request order.
    # Re-sort only if user used full catalog dump without care — keep explicit order.
    _ = known_order  # reserved for future "all" expansion
    return [{"key": k, "label": labels[k]} for k in ordered]


def project_related_entries(
    function: str | None,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Filter Backend B related_entries down to configured fields.

    Returns a frontend-friendly payload::

        {
          "listKey": "achievements",
          "fields": [{"key": "...", "label": "..."}],
          "items": [{... only selected keys ...}],
          # plus the original list key for convenience:
          "achievements": [...]
        }
    """

    fields = selected_fields(function)
    field_keys = [f["key"] for f in fields]

    if not function or function not in _FUNCTION_SCHEMA:
        # Pass-through with empty projection metadata
        return {
            "listKey": "items",
            "fields": [],
            "items": [],
            **payload,
        }

    list_key, _catalog, _raw, _defaults = _FUNCTION_SCHEMA[function]
    raw_items = payload.get(list_key)
    if not isinstance(raw_items, list):
        # Try common aliases
        for alias in ("achievements", "items", "entries", "list"):
            candidate = payload.get(alias)
            if isinstance(candidate, list):
                raw_items = candidate
                list_key = alias
                break
        else:
            raw_items = []

    items: list[dict[str, Any]] = []
    for row in raw_items:
        if not isinstance(row, dict):
            continue
        if field_keys:
            items.append({k: row.get(k, "") for k in field_keys})
        else:
            items.append(dict(row))

    result: dict[str, Any] = {
        "listKey": list_key,
        "fields": fields,
        "items": items,
        list_key: items,
    }
    return result
