<script setup lang="ts">
import type { DropdownMenuCheckboxItemEmits, DropdownMenuCheckboxItemProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Check } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DropdownMenuCheckboxItemProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<DropdownMenuCheckboxItemEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuCheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    v-bind="forwarded"
    :class=" cn(
      `relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2 pr-2.5 pl-8 text-sm font-medium outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
      props.class,
    )"
  >
    <span class="pointer-events-none absolute left-2.5 flex size-3.5 items-center justify-center">
      <DropdownMenuItemIndicator>
        <slot name="indicator-icon">
          <Check class="size-4" />
        </slot>
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>
