import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { TiendaNubeClient } from 'src/infra/tiendanube';
import { TiendaNubeEvent } from 'src/infra/tiendanube/types/events';

@Injectable()
export class OrdersService {
  async upsert(body: TiendaNubeEvent) {
    const tnCli = new TiendaNubeClient();
    const {
      products,
      id,
      created_at,
      payment_status,
      status,
      cancelled_at,
      owner_note,
      contact_name,
      number,
    } = await tnCli.getOrder(body.id.toString());
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
    );

    const { data: itemData, error: itemError } = await supabaseClient
      .from('order_items')
      .upsert(
        products.map(({ id, product_id, variant_values, quantity }) => ({
          id,
          order_id: body.id,
          variant_values,
          quantity,
          product_id,
        })),
        { onConflict: 'quantity, variant_values' },
      );

    if (itemError) throw new Error(itemError.message);

    const { data, error } = await supabaseClient.from('orders').upsert(
      {
        id,
        created_at,
        payment_status,
        status,
        cancelled_at,
        owner_note,
        contact_name,
        number,
      },
      { onConflict: 'payment_status, status, cancelled_at' },
    );

    if (error) throw new Error(error.message);

    return { data, itemData };
  }

  async delete(body: TiendaNubeEvent) {
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
    );

    const { error: itemError } = await supabaseClient
      .from('order_items')
      .delete()
      .eq('order_id', body.id);

    if (itemError) throw new Error(itemError.message);

    const { error } = await supabaseClient
      .from('orders')
      .delete()
      .eq('id', body.id);

    if (error) throw new Error(error.message);

    return body.id;
  }
}
