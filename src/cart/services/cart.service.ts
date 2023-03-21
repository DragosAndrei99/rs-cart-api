import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { poolQuery } from '../../db/index';

import { v4 } from 'uuid';

import { Cart, CartItem } from '../models';

@Injectable()
export class CartService {
  private userCarts: Record<string, Cart> = {};

  async findByUserId(userId: string): Promise<Cart> {
    const selectCartsById = 'SELECT * FROM carts WHERE user_id=$1';
    const values = [userId];
    const cartOfUser: QueryResult = await poolQuery(selectCartsById, values);
    if(!cartOfUser || cartOfUser.rowCount < 1) {
      return null;
    }
    const selectCartItems = 'SELECT * FROM cart_items WHERE cart_id=$1';
    const cartItems: QueryResult = await poolQuery(selectCartItems, [cartOfUser?.rows?.[0].id]);
    const cart = {
      id: cartOfUser?.rows[0]?.id,
      items: (cartItems?.rows?.length > 0) ? cartItems.rows.map(cartItem => ({
        product: { ...cartItem },
        count: cartItem.count,
      })) : [],
    };
    return cart;
  }

  async createByUserId(userId: string): Promise<Cart> {
    const insertCart = `
    INSERT INTO carts (user_id, id, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING *`;
    const values = [userId, v4(v4()), new Date(), new Date()];
    const newCart: QueryResult = await poolQuery(insertCart, values);
    console.log('newCart', newCart);
    return {
      id: newCart?.rows[0]?.id,
      items: [],
    };
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return await this.createByUserId(userId);
  }

  async updateByUserId(userId: string, items : CartItem[]): Promise<Cart> {
    const { id } = await this.findOrCreateByUserId(userId);

    let updatedCart: QueryResult;
    for(const item of items) {
      const values = [id, item.product.id, item.count];
      const updateCart = 'UPDATE cart_items SET count=$3 WHERE cart_id=$1 AND product_id=$2';
      updatedCart= await poolQuery(updateCart, values);
    }

    // if cart does not have products
    if(updatedCart.rowCount < 0) {
      return null;
    }

    return { 
      id: updatedCart?.rows[0]?.id,
      items: (updatedCart?.rows?.length > 0) ? updatedCart.rows.map(cartItem => ({
      product: { ...cartItem },
      count: cartItem.count,
      })) : []};
  }

  async removeByUserId(userId): Promise<void> {
    const deleteCart = `DELETE FROM carts WHERE user_id=$1`
    await poolQuery(deleteCart, [userId]);
  }

}
