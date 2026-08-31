import { useEffect, useState } from 'react';
import GetTemplatesTab from './GetTemplatesTab';
import SendTemplateTab from './SendTemplateTab';
import LogsTab from './LogsTab';
import { MSG91 } from '../../config/msg91';
import './WhatsApp.scss';

type WhatsAppPersonName = 'Sarita' | 'Monia';

const WHATSAPP_TABS = [
    { id: 'get-templates', label: 'Get Templates' },
    { id: 'create-templates', label: 'Create Templates' },
    { id: 'send-template', label: 'Send Template' },
    { id: 'logs', label: 'Logs' },
] as const;

type WhatsAppTabId = (typeof WHATSAPP_TABS)[number]['id'];

export default function WhatsAppPerson({ person }: { person: WhatsAppPersonName }) {
    const [activeTab, setActiveTab] = useState<WhatsAppTabId>('get-templates');

    useEffect(() => {
        setActiveTab('get-templates');
    }, [person]);

    const activeLabel = WHATSAPP_TABS.find((tab) => tab.id === activeTab)?.label ?? 'Get Templates';
    const showMoniaTemplates = person === 'Monia' && activeTab === 'get-templates';
    const showSendTemplate = activeTab === 'send-template';
    const showLogs = activeTab === 'logs';
    const defaultNumber = person === 'Sarita' ? MSG91.numbers.sarita : MSG91.numbers.monia;

    return (
        <section className="wa-page">
            <div className="card wa-tabs-card">
                <div className="wa-page-title">{person}</div>
                <div className="wa-tabs-row" role="tablist" aria-label={`${person} WhatsApp`}>
                    {WHATSAPP_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`wa-tab-${person}-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls={`wa-panel-${person}-${tab.id}`}
                            className={activeTab === tab.id ? 'wa-tab wa-tab--active' : 'wa-tab'}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div
                    className={
                        showMoniaTemplates || showLogs
                            ? 'wa-tab-panel wa-tab-panel--flush'
                            : showSendTemplate
                              ? 'wa-tab-panel wa-tab-panel--send'
                              : 'wa-tab-panel'
                    }
                    role="tabpanel"
                    id={`wa-panel-${person}-${activeTab}`}
                    aria-labelledby={`wa-tab-${person}-${activeTab}`}
                >
                    {showSendTemplate ? (
                        <SendTemplateTab defaultIntegratedNumber={defaultNumber} />
                    ) : showLogs ? (
                        <LogsTab integratedNumber={defaultNumber} />
                    ) : showMoniaTemplates ? (
                        <GetTemplatesTab integratedNumber={MSG91.numbers.monia} />
                    ) : (
                        <>
                            <h3 className="wa-tab-panel-title">{activeLabel}</h3>
                            <p className="wa-tab-panel-copy">
                                {activeTab === 'get-templates' && `View WhatsApp templates for ${person}.`}
                                {activeTab === 'create-templates' && `Create a new WhatsApp template for ${person}.`}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
