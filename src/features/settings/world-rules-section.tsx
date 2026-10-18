import { useSendCommand } from "../../app/use-engine.ts";
import { describeParameterGroups, type ParameterField, type ParameterGroupField } from "../../content/parameters.ts";
import type { ParameterValue } from "../../content/powers.ts";
import { DEFAULT_WORLD_RULES, readWorldRules, type WorldRules, worldRulesSchema } from "../../content/world-rules.ts";
import { TextButton } from "../../design/buttons.tsx";
import { useHeldDraft } from "../../design/use-held-draft.ts";
import { ParameterControl } from "../parameters/parameter-control.tsx";
import { useWorldStore } from "../world/world-store.ts";

const RULE_GROUPS = describeParameterGroups(worldRulesSchema);

type RuleValues = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

function ruleValue(rules: RuleValues, groupKey: string, fieldKey: string): ParameterValue | undefined {
  const value = rules[groupKey]?.[fieldKey];

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  return undefined;
}

function useWorldRules() {
  const confirmedRules = useWorldStore((state) => state.snapshot?.rules);
  const send = useSendCommand();

  const [rules, holdRules] = useHeldDraft(confirmedRules);

  const applyRules = (next: WorldRules) => {
    holdRules(next);
    send({ rules: next, type: "setWorldRules" });
  };

  const changeRule = (groupKey: string, fieldKey: string, value: ParameterValue) => {
    if (rules === undefined) {
      return;
    }

    const groups: RuleValues = rules;

    applyRules(readWorldRules({ ...groups, [groupKey]: { ...groups[groupKey], [fieldKey]: value } }));
  };

  const resetRules = () => applyRules(DEFAULT_WORLD_RULES);

  return { changeRule, resetRules, rules };
}

function useRuleChange(
  groupKey: string,
  onChange: (groupKey: string, fieldKey: string, value: ParameterValue) => void
) {
  return (key: string, value: ParameterValue) => onChange(groupKey, key, value);
}

function RuleControl({
  field,
  group,
  onChange,
  rules,
}: {
  readonly field: ParameterField;
  readonly group: ParameterGroupField;
  readonly onChange: (groupKey: string, fieldKey: string, value: ParameterValue) => void;
  readonly rules: WorldRules;
}) {
  const handleChange = useRuleChange(group.key, onChange);

  return <ParameterControl field={field} onChange={handleChange} value={ruleValue(rules, group.key, field.key)} />;
}

function RuleGroup({
  group,
  onChange,
  rules,
}: {
  readonly group: ParameterGroupField;
  readonly onChange: (groupKey: string, fieldKey: string, value: ParameterValue) => void;
  readonly rules: WorldRules;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl bg-veil p-4">
      <legend className="sr-only">{group.metadata.label}</legend>

      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold text-ink text-sm">{group.metadata.label}</h3>

        <p className="text-ink-muted text-xs">{group.metadata.description}</p>
      </div>

      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {group.fields.map((field) => (
          <RuleControl field={field} group={group} key={field.key} onChange={onChange} rules={rules} />
        ))}
      </div>
    </fieldset>
  );
}

export function WorldRulesSection() {
  const { changeRule, resetRules, rules } = useWorldRules();

  if (rules === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">Tune how nature and people behave on this island.</p>

        <TextButton onClick={resetRules} tone="quiet">
          Reset all
        </TextButton>
      </div>

      {RULE_GROUPS.map((group) => (
        <RuleGroup group={group} key={group.key} onChange={changeRule} rules={rules} />
      ))}
    </div>
  );
}
