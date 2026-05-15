import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { configStore, getDefaultApiBase } from "@/lib/config";
import { useTheme } from "@/theme";

interface Props {
  /** When true, the editor renders fully expanded with no collapse toggle. */
  alwaysExpanded?: boolean;
}

export function BackendUrlEditor({ alwaysExpanded = false }: Props) {
  const t = useTheme();
  // imperative subscription to the zustand store — avoids hook-order surprises
  // with React 19 + zustand v5's internal useCallback/useSyncExternalStore mix
  const [apiBase, setApiBase] = useState(() => configStore.getState().apiBase);
  const [override, setOverride] = useState(() => configStore.getState().override);
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [input, setInput] = useState(() => {
    const s = configStore.getState();
    return s.override ?? s.apiBase;
  });

  useEffect(() => {
    return configStore.subscribe((state) => {
      setApiBase(state.apiBase);
      setOverride(state.override);
    });
  }, []);

  useEffect(() => {
    setInput(override ?? apiBase);
  }, [override, apiBase]);

  const save = async () => {
    await configStore.getState().setOverride(input);
    if (!alwaysExpanded) setExpanded(false);
  };
  const reset = async () => {
    await configStore.getState().setOverride(null);
    setInput(getDefaultApiBase());
  };

  return (
    <View
      style={{
        borderTopWidth: alwaysExpanded ? 0 : 1,
        borderTopColor: t.colors.border,
        paddingTop: alwaysExpanded ? 0 : t.space.md,
        gap: t.space.sm,
      }}
    >
      {alwaysExpanded ? (
        <View style={{ gap: 2 }}>
          <Text variant="label" muted>
            backend {override ? "(custom)" : "(auto)"}
          </Text>
          <Text variant="mono" muted style={{ fontSize: 11 }} numberOfLines={1}>
            {apiBase}
          </Text>
        </View>
      ) : (
        <Pressable onPress={() => setExpanded((s) => !s)}>
          <Text variant="label" muted>
            backend {override ? "(custom)" : "(auto)"} {expanded ? "▾" : "▸"}
          </Text>
          <Text variant="mono" muted style={{ fontSize: 11 }} numberOfLines={1}>
            {apiBase}
          </Text>
        </Pressable>
      )}

      {expanded && (
        <View style={{ gap: t.space.sm }}>
          <Input
            label="Backend URL"
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.x.x:8000"
            hint={`default: ${getDefaultApiBase()}`}
          />
          <View style={{ flexDirection: "row", gap: t.space.sm }}>
            <Button label="Save" onPress={save} />
            <Button label="Reset" variant="secondary" onPress={reset} />
          </View>
        </View>
      )}
    </View>
  );
}
