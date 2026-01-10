
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'https://deno.land/std@0.181.0/encoding/csv.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Usuario no autenticado')

        const formData = await req.formData()
        const file = formData.get('file')
        const bankAccountId = formData.get('bank_account_id')
        const currencyCode = formData.get('currency_code')
        const categoryId = formData.get('category_id')

        if (!file || !bankAccountId || !currencyCode || !categoryId) {
            throw new Error('Faltan datos obligatorios')
        }

        if (!(file instanceof File)) throw new Error('El archivo no es válido')

        const text = await file.text()

        // Parse CSV
        // Expected headers: fecha,descripción,valor
        // Options: skipFirstRow: true if using headers in parse? 
        // parse() with { skipFirstRow: true, columns: [...] } or just array of arrays

        const result = await parse(text, { skipFirstRow: true });

        // Result is array of objects if columns provided, or array of strings?
        // "fecha,descripción,valor"
        // Let's assume standard headers.

        // Note: 'parse' from std returns array of objects if 'columns' not set but header line exists usually?
        // Actually std/csv parse behaviors:
        // If input has header, we can use it.

        // Let's manually parse or verify headers.
        // The library `parse` automatically handles headers if we convert to objects manually or use `columns` option.
        // Simpler: use the rows.

        const rows = result.map((row: any) => {
            // row might be array [date, desc, amount] or object {fecha, descripción, valor} depending on options.
            // Default parse returns array of strings without options.
            // But wait, I need to know which column is which.
            // Let's assume the user follows the template strictly: Col 1 = fecha, Col 2 = descripción, Col 3 = valor

            // If row is object (from header):
            let dateStr, desc, amountStr;

            if (Array.isArray(row)) {
                dateStr = row[0];
                desc = row[1];
                amountStr = row[2];
            } else {
                // Best guess for keys
                const keys = Object.keys(row);
                // normalization needed?
                // Let's rely on index.
                const values = Object.values(row);
                dateStr = values[0];
                desc = values[1];
                amountStr = values[2];
            }

            if (!dateStr || !amountStr) return null; // Skip empty rows

            // Parse Date: DD/MM/YYYY -> YYYY-MM-DD
            const [d, m, y] = (dateStr as string).split('/');
            if (!d || !m || !y) throw new Error(`Formato de fecha inválido: ${dateStr}`);
            const isoDate = `${y}-${m}-${d}`;

            return {
                user_id: user.id,
                occurred_at: isoDate,
                description: desc,
                amount: parseFloat(amountStr as string),
                currency_code: currencyCode,
                bank_account_id: bankAccountId,
                category_id: categoryId,
                // subcategory_id: null // optional
            };
        }).filter(r => r !== null);

        if (rows.length === 0) throw new Error("No se encontraron transacciones válidas en el archivo.");

        // Batch Insert
        // We try to insert all. Supabase limit typically is high enough for 5MB file (depends on row count).
        // If > 1000, we chunk it.

        const CHUNK_SIZE = 1000;
        let insertedCount = 0;
        const insertedIds: string[] = [];

        // Strategy: Insert chunk by chunk. If error, delete previously inserted IDs (Compensation).

        try {
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabase.from('transactions').insert(chunk).select('id');

                if (error) {
                    throw error;
                }

                if (data) {
                    insertedIds.push(...data.map(x => x.id));
                    insertedCount += data.length;
                }
            }
        } catch (insertError) {
            // Rollback
            if (insertedIds.length > 0) {
                await supabase.from('transactions').delete().in('id', insertedIds);
            }
            throw new Error(`Error en la inserción: ${insertError.message}. Se ha revertido el proceso.`);
        }

        return new Response(
            JSON.stringify({ success: true, inserted: insertedCount, message: 'Carga exitosa' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
