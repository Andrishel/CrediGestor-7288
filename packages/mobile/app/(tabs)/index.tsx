import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import React from "react";

// Local lightweight icon substitutes to avoid dependency on 'lucide-react-native'
// These use emoji rendered in a Text element as a simple fallback for development.
const IconStyle = ({ size = 20, color = "#000", children }: any) => (
  <Text style={{ fontSize: size, color }}>{children}</Text>
);

const Users = (props: any) => <IconStyle {...props}>👥</IconStyle>;
const FileText = (props: any) => <IconStyle {...props}>📄</IconStyle>;
const ArrowRight = (props: any) => <IconStyle {...props}>➜</IconStyle>;
const ShieldCheck = (props: any) => <IconStyle {...props}>🛡️</IconStyle>;
import { useRouter } from "expo-router";

export default function Index() {
  const colors = useColors();
  const router = useRouter();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header de Bienvenida */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: "#10b981" }]}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>CrediGestor</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Control de cobros y préstamos</Text>
          </View>
        </View>

        {/* Tarjeta de Resumen Rápido */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={20} color="#10b981" />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Sistema Operativo</Text>
          </View>
          <Text style={[styles.cardText, { color: colors.mutedForeground }]}>
            Sincronizado correctamente con tu base de datos en tiempo real. Selecciona un módulo para gestionar tus operaciones.
          </Text>
        </View>

        {/* Accesos Directos Principales */}
        <View style={styles.menuGrid}>
          <Pressable
            onPress={() => router.push("/(tabs)/explore" as any)} 
            style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconBox, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
              <Users size={24} color="#10b981" />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>Clientes</Text>
              <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>Directorio y morosidad</Text>
            </View>
            <ArrowRight size={18} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/explore" as any)}
            style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconBox, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
              <FileText size={24} color="#3b82f6" />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>Préstamos</Text>
              <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>Cuotas y desembolsos</Text>
            </View>
            <ArrowRight size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18,
  },
  menuGrid: {
    gap: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  menuDesc: {
    fontSize: 12,
  },
});