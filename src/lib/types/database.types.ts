// Auto-generated types from Supabase — regenerate with:
//   npx supabase gen types typescript --project-id <ID> > src/lib/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TipoEvento =
  | "RECEBIMENTO"
  | "ENTREGA"
  | "DEVOLUCAO_ORIGEM"
  | "RETORNO";

export type StatusOperacao = "EM_ANDAMENTO" | "FINALIZADA";

export interface LinhaExport {
  tipo_encomenda: string;
  tipo_evento: string;
  operacao: string;
  rota: string;
  colaborador: string;
  data_hora: string;
  motorista: string | null;
  codigo: string;
  status: "OK" | "Override aplicado";
}

export interface DashboardBipagensExport {
  total: number;
  truncado: boolean;
  linhas: LinhaExport[];
}

export interface RankingItem {
  total: number;
  dias_trabalhados: number;
  media_dia: number;
}

export interface DashboardKpis {
  total: number;
  por_dia: { dia: string; total: number }[];
  por_transportadora: { transportadora: string; total: number }[];
  por_motorista: ({ motorista: string } & RankingItem)[];
  ranking_colaboradores: ({ colaborador: string } & RankingItem)[];
  por_tipo_evento: { tipo_evento: TipoEvento; total: number }[];
  por_dia_transportadora: { dia: string; transportadora: string; total: number }[];
  heatmap_galpao_tipo: { galpao: string; tipo_evento: TipoEvento; total: number }[];
  por_rota_treemap: { galpao: string; rota: string; total: number; insucesso: number }[];
  funil: {
    recebido: number;
    bipado: number;
    em_rota: number;
    entregue: number;
  };
  sankey_fluxo: {
    recebido: number;
    entregue: number;
    devolvido: number;
    retornado: number;
    em_aberto: number;
  };
  recebimento_total: number;
  entrega_total: number;
  overrides_aplicados: number;
}

export interface Database {
  public: {
    Tables: {
      cidades: {
        Row: {
          id: string;
          nome: string;
          uf: string;
          ativo: boolean;
          criada_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cidades"]["Row"], "id" | "criada_em">;
        Update: Partial<Database["public"]["Tables"]["cidades"]["Insert"]>;
        Relationships: [];
      };
      galpoes: {
        Row: {
          id: string;
          cidade_id: string;
          nome: string;
          endereco: string | null;
          ativo: boolean;
          criado_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["galpoes"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["public"]["Tables"]["galpoes"]["Insert"]>;
        Relationships: [];
      };
      bairros: {
        Row: {
          id: string;
          cidade_id: string;
          nome: string;
          ativo: boolean;
          criado_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bairros"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["public"]["Tables"]["bairros"]["Insert"]>;
        Relationships: [];
      };
      transportadoras: {
        Row: {
          id: string;
          nome: string;
          regex_validacao: string | null;
          ativo: boolean;
          criado_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["transportadoras"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["public"]["Tables"]["transportadoras"]["Insert"]>;
        Relationships: [];
      };
      colaboradores: {
        Row: {
          id: string;
          galpao_id: string;
          user_id: string;
          nome: string;
          cpf: string | null;
          email: string;
          papel: "admin" | "gerente" | "colaborador";
          ativo: boolean;
          criado_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["colaboradores"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["public"]["Tables"]["colaboradores"]["Insert"]>;
        Relationships: [];
      };
      motoristas: {
        Row: {
          id: string;
          galpao_id: string;
          nome: string;
          cpf: string | null;
          cnh: string | null;
          placa: string | null;
          telefone: string | null;
          ativo: boolean;
          criado_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["motoristas"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["public"]["Tables"]["motoristas"]["Insert"]>;
        Relationships: [];
      };
      rotas: {
        Row: {
          id: string;
          galpao_id: string;
          nome: string;
          ativa: boolean;
          eh_recebimento: boolean;
          criada_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rotas"]["Row"], "id" | "criada_em" | "eh_recebimento"> & {
          eh_recebimento?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["rotas"]["Insert"]>;
        Relationships: [];
      };
      rota_bairros: {
        Row: {
          rota_id: string;
          bairro_id: string;
          ordem: number;
        };
        Insert: Database["public"]["Tables"]["rota_bairros"]["Row"];
        Update: Partial<Database["public"]["Tables"]["rota_bairros"]["Row"]>;
        Relationships: [];
      };
      operacoes: {
        Row: {
          id: string;
          galpao_id: string;
          transportadora_id: string;
          tipo_evento: TipoEvento;
          data: string;
          colaborador_id: string;
          status: StatusOperacao;
          iniciada_em: string;
          finalizada_em: string | null;
          ativa: boolean;
        };
        Insert: Omit<
          Database["public"]["Tables"]["operacoes"]["Row"],
          "id" | "status" | "iniciada_em" | "ativa"
        > & { ativa?: boolean };
        Update: Partial<Omit<Database["public"]["Tables"]["operacoes"]["Row"], "id" | "iniciada_em">>;
        Relationships: [];
      };
      bipagens: {
        Row: {
          id: string;
          operacao_id: string;
          rota_id: string;
          motorista_id: string | null;
          transportadora_id: string;
          codigo: string;
          tipo_evento: TipoEvento;
          colaborador_id: string;
          bipado_em: string;
          override_aplicado: boolean;
          sincronizado_em: string | null;
          ciclo_fechado: boolean;
          motivo: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["bipagens"]["Row"],
          "id" | "bipado_em" | "override_aplicado" | "ciclo_fechado" | "motivo"
        > & {
          bipado_em?: string;
          override_aplicado?: boolean;
          ciclo_fechado?: boolean;
          motivo?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bipagens"]["Insert"]>;
        Relationships: [];
      };
      manifestos: {
        Row: {
          id: string;
          operacao_id: string;
          nome_arquivo: string;
          total_itens: number;
          encontradas: number;
          faltantes: number;
          extras: number;
          importado_em: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["manifestos"]["Row"],
          "id" | "importado_em" | "encontradas" | "faltantes" | "extras"
        > & {
          encontradas?: number;
          faltantes?: number;
          extras?: number;
        };
        Update: Partial<Database["public"]["Tables"]["manifestos"]["Insert"]>;
        Relationships: [];
      };
      manifesto_itens: {
        Row: {
          id: string;
          manifesto_id: string;
          codigo: string;
          descricao: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["manifesto_itens"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["manifesto_itens"]["Insert"]>;
        Relationships: [];
      };
      configuracoes: {
        Row: {
          chave: string;
          valor: string;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["configuracoes"]["Row"], "atualizado_em">;
        Update: Partial<Database["public"]["Tables"]["configuracoes"]["Insert"]>;
        Relationships: [];
      };
      auditoria: {
        Row: {
          id: string;
          tipo: string;
          descricao: string;
          usuario_id: string | null;
          dados: Json | null;
          criado_em: string;
        };
        Insert: Omit<Database["public"]["Tables"]["auditoria"]["Row"], "id" | "criado_em">;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      tentar_override: {
        Args: {
          senha_tentativa: string;
          p_codigo: string;
          p_operacao_id: string;
          p_rota_id: string;
        };
        Returns: boolean;
      };
      desfazer_bipagem: {
        Args: { p_bipagem_id: string };
        Returns: undefined;
      };
      alterar_senha_override: {
        Args: { p_nova_senha: string };
        Returns: undefined;
      };
      home_entregas_chart: {
        Args: Record<string, never>;
        Returns: Array<{ periodo: string; transportadora: string; total: number }>;
      };
      dashboard_kpis: {
        Args: {
          p_data_inicio: string;
          p_data_fim: string;
          p_galpao_ids?: string[] | null;
          p_transportadora_ids?: string[] | null;
          p_tipos_evento?: TipoEvento[] | null;
          p_operacao_ids?: string[] | null;
          p_rota_ids?: string[] | null;
          p_colaborador_ids?: string[] | null;
          p_motorista_ids?: string[] | null;
        };
        Returns: DashboardKpis;
      };
      dashboard_bipagens_export: {
        Args: {
          p_data_inicio: string;
          p_data_fim: string;
          p_galpao_ids?: string[] | null;
          p_transportadora_ids?: string[] | null;
          p_tipos_evento?: TipoEvento[] | null;
          p_operacao_ids?: string[] | null;
          p_rota_ids?: string[] | null;
          p_colaborador_ids?: string[] | null;
          p_motorista_ids?: string[] | null;
        };
        Returns: DashboardBipagensExport;
      };
    };
    Enums: {
      tipo_evento: TipoEvento;
      status_operacao: StatusOperacao;
    };
  };
}
