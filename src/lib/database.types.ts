export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      libros: {
        Row: {
          anio: number | null
          autor: string
          autores_extra: string[]
          categoria: string
          created_at: string
          destacado: boolean
          editorial: string | null
          en_venta: boolean
          estado: string
          estado_conservacion: string | null
          etiquetas: string[]
          formato: string
          id: string
          idioma: string
          isbn: string | null
          notas: string | null
          paginas: number | null
          portada: string | null
          precio: number | null
          resena: string | null
          sinopsis: string | null
          slug: string
          subcategorias: string[]
          titulo: string
          ubicacion: string | null
          updated_at: string
          valoracion: number | null
        }
        Insert: {
          anio?: number | null
          autor: string
          autores_extra?: string[]
          categoria: string
          created_at?: string
          destacado?: boolean
          editorial?: string | null
          en_venta?: boolean
          estado?: string
          estado_conservacion?: string | null
          etiquetas?: string[]
          formato?: string
          id?: string
          idioma?: string
          isbn?: string | null
          notas?: string | null
          paginas?: number | null
          portada?: string | null
          precio?: number | null
          resena?: string | null
          sinopsis?: string | null
          slug: string
          subcategorias?: string[]
          titulo: string
          ubicacion?: string | null
          updated_at?: string
          valoracion?: number | null
        }
        Update: {
          anio?: number | null
          autor?: string
          autores_extra?: string[]
          categoria?: string
          created_at?: string
          destacado?: boolean
          editorial?: string | null
          en_venta?: boolean
          estado?: string
          estado_conservacion?: string | null
          etiquetas?: string[]
          formato?: string
          id?: string
          idioma?: string
          isbn?: string | null
          notas?: string | null
          paginas?: number | null
          portada?: string | null
          precio?: number | null
          resena?: string | null
          sinopsis?: string | null
          slug?: string
          subcategorias?: string[]
          titulo?: string
          ubicacion?: string | null
          updated_at?: string
          valoracion?: number | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
