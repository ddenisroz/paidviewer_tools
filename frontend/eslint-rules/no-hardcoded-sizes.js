/**
 * ESLint правило: запрет хардкода размеров кнопок
 * Использовать константы из designSystem.ts
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Запретить хардкод размеров кнопок (h-8 w-8, h-10 w-10)',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      hardcodedSize: 'Используйте константы из designSystem.ts вместо хардкода "{{value}}"',
    },
  },

  create(context) {
    const hardcodedPatterns = [
      /className=["'].*h-8\s+w-8/,
      /className=["'].*h-10\s+w-10/,
      /className=["'].*h-8\s+w-8\s+p-0/,
      /className=["'].*h-10\s+w-10\s+p-0/,
    ];

    return {
      JSXAttribute(node) {
        if (node.name.name !== 'className') return;
        
        const value = node.value;
        if (!value || value.type !== 'Literal') return;
        
        const classNameValue = value.value;
        
        for (const pattern of hardcodedPatterns) {
          if (pattern.test(classNameValue)) {
            context.report({
              node,
              messageId: 'hardcodedSize',
              data: {
                value: classNameValue,
              },
            });
          }
        }
      },
    };
  },
};
