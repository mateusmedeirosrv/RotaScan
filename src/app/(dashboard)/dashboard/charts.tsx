"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardKpis } from "@/lib/types/database.types";

const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
};

const CORES_DONUT = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

function formatarDia(dia: string) {
  const [, mes, dd] = dia.split("-");
  return `${dd}/${mes}`;
}

export function DashboardCharts({ dados }: { dados: DashboardKpis }) {
  const porDia = (dados.por_dia ?? []).map((d) => ({ ...d, diaLabel: formatarDia(d.dia) }));
  const porTipoEvento = (dados.por_tipo_evento ?? []).map((d) => ({
    ...d,
    label: TIPO_EVENTO_LABEL[d.tipo_evento] ?? d.tipo_evento,
  }));

  if (porDia.length === 0 && porTipoEvento.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma bipagem encontrada para o período e filtros selecionados.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Volume diário</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="diaLabel" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por tipo de evento</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={porTipoEvento}
                dataKey="total"
                nameKey="label"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {porTipoEvento.map((_, i) => (
                  <Cell key={i} fill={CORES_DONUT[i % CORES_DONUT.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por transportadora</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.por_transportadora}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="transportadora" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por motorista</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.por_motorista}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="motorista" angle={-20} textAnchor="end" height={60} interval={0} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
