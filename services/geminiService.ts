
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { HerbInfo, RemedyResult, StakeholderInfo, ShopInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const HERB_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isRelevantBotanical: { type: Type.BOOLEAN, description: "Whether the subject is a herb, culinary ingredient, or a medicinal plant." },
    classification: { type: Type.STRING, description: "If not a herb, spice, or medicinal plant, what is it?" },
    name: { type: Type.STRING },
    scientificName: { type: Type.STRING },
    leadingProducer: { type: Type.STRING, description: "The country that currently leads global production of this botanical item." },
    placeOfOrigin: { type: Type.STRING, description: "The historical geographical region or country where this botanical item is believed to have originated." },
    majorStakeholders: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Major companies, dominant market players, or state bodies that are the primary 'stockholders' or stakeholders in the production/export within the leading country."
    },
    description: { type: Type.STRING },
    multilingualNames: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING },
          native: { type: Type.STRING, description: "Name in native script (e.g., Hindi script)" },
          english: { type: Type.STRING, description: "English name for the language" }
        },
        required: ["language", "native", "english"]
      }
    },
    benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
    recipe: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
        steps: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    availabilityRegions: { type: Type.ARRAY, items: { type: Type.STRING } },
    pricing: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          region: { type: Type.STRING },
          currency: { type: Type.STRING },
          priceRange: { type: Type.STRING }
        }
      }
    },
    relatedHerbs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the related herb, spice, or medicinal plant" },
          relationReason: { type: Type.STRING, description: "Why it is related (e.g., same family, similar flavor, similar medicinal use)" }
        },
        required: ["name", "relationReason"]
      },
      description: "2-3 related botanical suggestions"
    }
  },
  required: ["isRelevantBotanical", "name", "description"]
};

export const identifyHerb = async (input: { text?: string, imageBase64?: string }): Promise<HerbInfo> => {
  const parts: any[] = [];
  
  if (input.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: input.imageBase64.split(',')[1]
      }
    });
    parts.push({ text: "Identify this item. Is it a herb, culinary ingredient, or medicinal plant? Provide detailed info if yes. If not, say what it is." });
  } else if (input.text) {
    parts.push({ text: `Provide information about the botanical item: ${input.text}. It could be a herb, culinary ingredient, or medicinal plant. If it's none of these, identify what it is.` });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: HERB_SCHEMA,
      systemInstruction: "You are an expert herbalist, botanist, and pharmacognosist. Provide accurate information in the requested JSON format. Include names in Hindi, Tamil, Sanskrit, and Bengali. Suggest 2-3 related botanicals. Identify origin, leading producer, and major stockholders."
    }
  });

  return JSON.parse(response.text) as HerbInfo;
};

export const findLocalStockists = async (herbName: string, lat: number, lng: number): Promise<ShopInfo[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find 3-4 shops, nurseries, or specialty grocery stores within 5km of my location that are likely to sell ${herbName}. List them and provide Google Maps links.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      },
      systemInstruction: "You are a local botanical guide. Find real stores near the user coordinates that stock herbs and culinary plants. Prioritize specialty spice shops, organic groceries, and plant nurseries."
    },
  });

  const shops: ShopInfo[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  for (const chunk of groundingChunks) {
    if (chunk.maps) {
      shops.push({
        name: chunk.maps.title || "Local Shop",
        address: chunk.maps.address || "Nearby",
        uri: chunk.maps.uri || "#"
      });
    }
  }

  // Fallback if grounding chunks are not structured as expected but we have text
  if (shops.length === 0 && response.text) {
    // Basic text parsing for common patterns if maps grounding fails to provide objects but gives names
    const lines = response.text.split('\n');
    for (const line of lines) {
      if (line.includes('http') || line.includes('maps.google')) {
         const nameMatch = line.match(/^\d*\.?\s*(.*?):/);
         const urlMatch = line.match(/https?:\/\/[^\s)]+/);
         if (urlMatch) {
           shops.push({
             name: nameMatch ? nameMatch[1].trim() : "Local Stockist",
             address: "Address found in link",
             uri: urlMatch[0]
           });
         }
      }
    }
  }

  return shops.slice(0, 4);
};

export const getStakeholderDetails = async (name: string, contextHerb: string): Promise<StakeholderInfo> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide the contact details for the company or entity "${name}", which is a major stakeholder in the production or export of "${contextHerb}".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          address: { type: Type.STRING },
          contactNumber: { type: Type.STRING },
          website: { type: Type.STRING },
          background: { type: Type.STRING }
        },
        required: ["name", "address", "contactNumber"]
      },
      systemInstruction: "Provide realistic corporate contact information for agricultural stakeholders."
    }
  });

  return JSON.parse(response.text) as StakeholderInfo;
};

export const getRemedies = async (input: { text?: string, imageBase64?: string }): Promise<RemedyResult> => {
  const parts: any[] = [];
  if (input.imageBase64) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: input.imageBase64.split(',')[1] } });
  }
  parts.push({ text: `Analyze this health concern: "${input.text || 'Provided in image'}" and suggest remedies using common herbs.` });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          introduction: { type: Type.STRING },
          solutions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                herbName: { type: Type.STRING },
                remedyTitle: { type: Type.STRING },
                description: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                preparationSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                whyItWorks: { type: Type.STRING },
                safetyWarning: { type: Type.STRING }
              },
              required: ["herbName", "remedyTitle", "description", "ingredients", "preparationSteps", "whyItWorks", "safetyWarning"]
            }
          },
          generalAdvice: { type: Type.STRING }
        },
        required: ["introduction", "solutions", "generalAdvice"]
      }
    }
  });
  return JSON.parse(response.text) as RemedyResult;
};

export const askFollowUp = async (problem: string, history: any[], question: string) => {
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction: "Provide expert herbalist follow-up advice." }
  });
  const response = await chat.sendMessage({ message: question });
  return response.text;
};

export const generateHerbImage = async (name: string): Promise<string | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Professional botanical photo of ${name}.` }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const generateProblemCartoon = async (problem: string): Promise<string | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A cartoon illustration of someone with: ${problem}.` }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};
