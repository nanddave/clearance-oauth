import { parseGuide, type Guide } from "./schema";
import gmail from "../../data/guides/gmail.json";
import slack from "../../data/guides/slack.json";
import docusign from "../../data/guides/docusign.json";
import xero from "../../data/guides/xero.json";
import github from "../../data/guides/github.json";
import gusto from "../../data/guides/gusto.json";

const guides: Guide[] = [gmail, slack, docusign, xero, github, gusto].map(parseGuide);

export const listGuides = (): Guide[] => guides;
export const getGuide = (slug: string): Guide | null => guides.find((g) => g.slug === slug) ?? null;
