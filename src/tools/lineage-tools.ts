/**
 * Tool definitions for data lineage and impact analysis
 */

export const LINEAGE_TOOLS = {
  qlik_get_lineage: {
    name: 'qlik_get_lineage',
    description: `Get lineage information for a dataset or resource. REQUIRES QRI from dataset.rawDataset.secureQri

**IMPORTANT:** The nodeId must be a QRI (Qlik Resource Identifier), not a regular ID.
- Get QRI from: dataset.rawDataset.secureQri
- Format: qri:qdf:space://[spaceId]#[itemId]
- If you only have a dataset ID, first call get_dataset_details to get the QRI`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'QRI of the node (from dataset.rawDataset.secureQri)'
        },
        direction: {
          type: 'string',
          enum: ['upstream', 'downstream', 'both'],
          default: 'both',
          description: 'Direction to traverse lineage'
        },
        levels: {
          type: 'number',
          default: 5,
          description: 'Number of levels to traverse (-1 for unlimited)'
        },
        includeFields: {
          type: 'boolean',
          default: false,
          description: 'Include field-level lineage'
        },
        includeTables: {
          type: 'boolean',
          default: false,
          description: 'Include table-level lineage'
        }
      },
      required: ['nodeId']
    }
  },

};
