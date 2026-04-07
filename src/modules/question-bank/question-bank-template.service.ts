import { Injectable } from '@nestjs/common';
import xlsx from 'xlsx';

@Injectable()
export class QuestionBankTemplateService {
  getImportTemplate(): { fileName: string; buffer: Buffer } {
    const rows = [
      [
        '请按模板填写题目数据。题型：single_choice / multi_choice / fill_text / rich_text。选择题选项格式：A:选项1;B:选项2；多选答案格式：A,B。',
      ],
      [
        'title',
        'type',
        'score',
        'options',
        'answer',
        'analysis',
        'description',
      ],
      [
        '# 题干',
        '题型',
        '分值',
        '选项（选择题必填）',
        '参考答案',
        '题目解析（可选）',
        '补充说明（可选）',
      ],
      [
        '单选题示例',
        'single_choice',
        5,
        'A:选项1;B:选项2',
        'A',
        '单选题解析示例',
        '',
      ],
      [
        '多选题示例',
        'multi_choice',
        10,
        'A:选项1;B:选项2;C:选项3',
        'A,B',
        '多选题解析示例',
        '',
      ],
      ['填空题示例', 'fill_text', 5, '', '示例填空答案', '填空题解析示例', ''],
      ['简答题示例', 'rich_text', 15, '', '示例简答答案', '简答题解析示例', ''],
    ];

    const guideRows = [
      ['字段', '说明', '是否必填', '示例'],
      ['title', '题干', '是', '单选题示例'],
      ['type', '题型', '是', 'single_choice'],
      ['score', '分值', '是', '5'],
      [
        'options',
        '选择题选项，格式 A:选项1;B:选项2',
        '选择题必填',
        'A:选项1;B:选项2',
      ],
      ['answer', '参考答案；多选用逗号分隔', '是', 'A 或 A,B'],
      ['analysis', '题目解析', '否', '单选题解析示例'],
      ['description', '补充说明', '否', '题目来源或说明'],
    ];

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const guideSheet = xlsx.utils.aoa_to_sheet(guideRows);

    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    worksheet['!cols'] = [
      { wch: 36 },
      { wch: 18 },
      { wch: 10 },
      { wch: 42 },
      { wch: 18 },
      { wch: 30 },
      { wch: 28 },
    ];
    guideSheet['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 14 }, { wch: 28 }];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');
    xlsx.utils.book_append_sheet(workbook, guideSheet, 'Guide');

    const rawBuffer: unknown = xlsx.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    });
    const buffer = Buffer.isBuffer(rawBuffer)
      ? rawBuffer
      : Buffer.from(rawBuffer as Uint8Array);

    return {
      fileName: '题库导入模板.xlsx',
      buffer,
    };
  }
}
