'use client'
import { motion } from 'framer-motion'
import { ny } from '@/lib/utils'

interface BlurIntProps {
   word: string
   className?: string
   variant?: {
      hidden: { filter: string, opacity: number }
      visible: { filter: string, opacity: number }
   }
   duration?: number
}
function BlurIn({ word, className, variant, duration = 1 }: BlurIntProps) {
   const defaultVariants = {
      hidden: { filter: 'blur(10px)', opacity: 0 },
      visible: { filter: 'blur(0px)', opacity: 1 },
   }
   const combinedVariants = variant || defaultVariants

   return (
      <motion.h1
         initial="hidden"
         animate="visible"
         transition={{ duration }}
         variants={combinedVariants}
         className={ny(
            className,
            'text-2xl font-medium tracking-tight',
         )}
      >
         {word}
      </motion.h1>
   )
}

export default BlurIn
