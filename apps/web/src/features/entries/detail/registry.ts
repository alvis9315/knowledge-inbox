import type { Component } from 'vue'
import DefaultDetailBody from './DefaultDetailBody.vue'
import FoodDetailBody from './FoodDetailBody.vue'
import LearnDetailBody from './LearnDetailBody.vue'

/**
 * Per-大類別 detail body components. The detail page shell stays the same
 * (back / badges / export); only the body varies by domain. Add a mapping to
 * introduce a new type-specific layout — modular and open for extension.
 */
const BY_DOMAIN: Record<string, Component> = {
  美食: FoodDetailBody,
  學習: LearnDetailBody,
}

export function detailBodyFor(domain: string | undefined | null): Component {
  return (domain && BY_DOMAIN[domain]) || DefaultDetailBody
}
