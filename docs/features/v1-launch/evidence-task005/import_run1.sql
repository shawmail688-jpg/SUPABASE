begin;
select set_config('app.migration', 'on', true);
select set_config('app.actor_uuid', '11111111-1111-1111-1111-111111111111', true);

with v(id uuid, code text, name text, address text, grp text, created_by uuid) as (
  values
  (uuid '5d255ce7-e779-5a96-8468-2c0593468375', (select id from public.project where code = 'uganda-showroom'), 'Hernely business park', 'SR-HERNELY-BUSINESS-PARK', 'Mulwana road', null, '11111111-1111-1111-1111-111111111111'),
  (uuid '2f3718b5-e121-5a8f-af08-0cd1bb49e6b7', (select id from public.project where code = 'uganda-showroom'), 'Former hisence showroom Plot 7 AK', 'SR-FORMER-HISENCE-SHOWROOM-', 'Old portbell road', null, '11111111-1111-1111-1111-111111111111'),
  (uuid '4aaba04f-8ddd-5d04-a51f-17ecede5d5e6', (select id from public.project where code = 'uganda-showroom'), 'Former Nexa solar', 'SR-FORMER-NEXA-SOLAR', 'Old portbell road', null, '11111111-1111-1111-1111-111111111111'),
  (uuid '97a85e3e-e7e3-5687-be5c-6090e5572ca9', (select id from public.project where code = 'uganda-showroom'), 'Affayo building', 'SR-AFFAYO-BUILDING', 'Ndeeba, masaka road', null, '11111111-1111-1111-1111-111111111111'),
  (uuid '2c02198f-2de8-5f1c-8ea2-a5389b3ce8ff', (select id from public.project where code = 'uganda-showroom'), 'BE FORWARD-MEIK CAR HUB', 'SR-BE-FORWARD-MEIK-CAR-HUB', 'Old Portbell Road Industrial area, Wankoko (Bugolobi)', null, '11111111-1111-1111-1111-111111111111'),
  (uuid '558d5051-7704-5086-b69b-c51709774e7b', (select id from public.project where code = 'uganda-showroom'), 'KAINIU MOTORS WAHAB', 'SR-KAINIU-MOTORS-WAHAB', 'Ndeeba, masaka road', null, '11111111-1111-1111-1111-111111111111'),
  (uuid '43e2e6db-9be5-5d87-a23a-d608ef371173', (select id from public.project where code = 'uganda-showroom'), 'Silent night', 'SR-SILENT-NIGHT', 'Parliamentary avenue slightly off kampala road', null, '11111111-1111-1111-1111-111111111111')
)
insert into public.site (id, project_id, code, name, address, grp, created_by)
select v.id, (select id from public.project where code = 'uganda-showroom'),
       v.code, v.name, v.address, v.grp, v.created_by
from v
where not exists (
  select 1 from public.site s
  where s.project_id = (select id from public.project where code = 'uganda-showroom')
    and s.code = v.code
);

insert into public.fengshui_eval (id, site_id, raw, created_by) values
  (uuid '23199fd3-c39e-58da-bf85-c806f4455270', uuid '5d255ce7-e779-5a96-8468-2c0593468375', '{"verdict": "pass", "score": 1, "summary": "硬 4/4 过：工业园路网平直无煞，前院停车缓冲充足，店面朝北。", "flags": [{"t": "s", "x": "S4 朝北"}], "rules": [["H1 路冲", "PASS — 主路直通；西侧 T 字岔口近 90° 非正冲"], ["H2 反弓", "PASS — 道路近直"], ["H3 割脚", "PASS — 前院 10-20m 停车缓冲"], ["H4 剪刀", "PASS — 无锐角岔口对建筑"], ["S1 明堂", "0 — 以路为明堂；大片空地在侧后非门前"], ["S2 玉带", "0 — 道路平直"], ["S3 靠山", "0 — 平地工业园"], ["S4 朝向", "+1 — 主立面朝北（路南），物流行业吉向"]], "note": "园区仓储格局与电摩展厅气质契合；核实租期与园区管理", "evidence": "Esri sat z18 458m + z19 229m · 房源级（链接真钉）", "date": "2026-09-02"}'::jsonb, '11111111-1111-1111-1111-111111111111'),
  (uuid 'fe3a6cf8-a3f7-5a2a-ab9c-5ba8a55fd3d5', uuid '2f3718b5-e121-5a8f-af08-0cd1bb49e6b7', '{"verdict": "pass", "score": 1, "summary": "硬 4/4 过：~20m 前院停车缓冲；南邻铁路线（噪声）与湿地带（气味）实用注记。", "flags": [{"t": "s", "x": "S1 前院明堂"}], "rules": [["H1 路冲", "PASS — 西侧岔口 60-90° 非正对"], ["H2 反弓", "PASS — Old Portbell Rd 该段直"], ["H3 割脚", "PASS — 前院 15-25m"], ["H4 剪刀", "PASS — 岔口近直角"], ["S1 明堂", "+1 — 门前 20m 车场空地"], ["S2 玉带", "0 — 道路直"], ["S3 靠山", "0 — 平地"], ["S4 朝向", "0 — 主立面朝 NW（路 NE-SW 斜向），非北"]], "note": "南侧紧邻铁路线（噪声振动）+ Nakivubo 湿地带（实地闻味）；与 Nexa 同址共钉", "evidence": "Esri sat z18 458m + z19 229m · 房源级（链接真钉）", "date": "2026-09-02"}'::jsonb, '11111111-1111-1111-1111-111111111111'),
  (uuid 'a972d676-8711-548c-a767-33b543fdf7b6', uuid '4aaba04f-8ddd-5d04-a51f-17ecede5d5e6', '{"verdict": "pass", "score": 1, "summary": "与 Hisence 同址共钉同排铺位，路异数学同判：硬 4/4 过，前院缓冲充足。", "flags": [{"t": "s", "x": "S1 前院明堂"}], "rules": [["H1 路冲", "PASS — 同 Hisence（同钉）"], ["H2 反弓", "PASS — 同钉直路段"], ["H3 割脚", "PASS — 前院 15-25m"], ["H4 剪刀", "PASS — 同 Hisence"], ["S1 明堂", "+1 — 门前车场空地"], ["S2 玉带", "0"], ["S3 靠山", "0"], ["S4 朝向", "0 — 朝 NW 非北"]], "note": "商业氛围更旺（对街 Victoria Motors/Mercantile）；南邻铁路+湿地同注记", "evidence": "Esri sat z18 458m + z19 229m · 房源级（与 Hisence 共钉同图）", "date": "2026-09-02"}'::jsonb, '11111111-1111-1111-1111-111111111111'),
  (uuid '828039dc-2f1e-5c69-b6e1-295964523344', uuid '97a85e3e-e7e3-5687-be5c-6090e5572ca9', '{"verdict": "caution", "score": 0, "summary": "H3 割脚骑线（墙线距路 3-8m 估算，正好骑阈值）：门前即人行道无退线；区位人气极旺。", "flags": [{"t": "c", "x": "H3 割脚骑线"}], "rules": [["H1 路冲", "PASS — 前街直通无 T 头正对"], ["H2 反弓", "PASS — 前街该段直"], ["H3 割脚", "⚠ 骑线 — 卫星+现场照估算 3-8m 无缓冲，阈值 <5m，待实地量"], ["H4 剪刀", "PASS — 周边路口近 90°"], ["S1 明堂", "0 — CBD 街铺以街为明堂"], ["S2 玉带", "0"], ["S3 靠山", "0 — 背为密集建成区"], ["S4 朝向", "0 — 朝 NW 非北；不临路口"]], "note": "紧邻新出租车公园（人气/客流顶级）；实地量门口退线定去留", "evidence": "Esri sat z18 458m + z19 229m · 房源级（链接真钉）", "date": "2026-09-02"}'::jsonb, '11111111-1111-1111-1111-111111111111'),
  (uuid '0f7d72af-899b-5cc0-9e23-7bea4f67362c', uuid '2c02198f-2de8-5f1c-8ea2-a5389b3ce8ff', '{"verdict": "caution", "score": 3, "summary": "软加分全场最高 3/4（明堂+玉带环抱+路口生气），但 H4 多路岔口夹角疑似 <60° 骑线——实地量角 ≥60° 即升合格。", "flags": [{"t": "c", "x": "H4 剪刀骑线"}, {"t": "s", "x": "S1 明堂"}, {"t": "s", "x": "S2 玉带"}, {"t": "s", "x": "S4 路口生气"}], "rules": [["H1 路冲", "PASS — 路弯绕场而过，无直路射门"], ["H2 反弓", "PASS — 场在弯道内凹侧"], ["H3 割脚", "PASS — 场院退线 10-20m"], ["H4 剪刀", "⚠ 骑线 — 西北多路岔口夹角 55-70° 估测，建筑角部临岔，实地量"], ["S1 明堂", "+1 — 门前场院开阔，对街大片绿地"], ["S2 玉带", "+1 — 主路环抱场院（弯内侧）"], ["S3 靠山", "0 — 平地"], ["S4 朝向", "+1 — 紧邻多路交汇口（生气汇集）"]], "note": "东南 ~250m 为污水处理厂圆池（主导风下气味风险，实地闻）；重车路口噪声", "evidence": "Esri sat z18 458m + z19 229m · 房源级（链接真钉）", "date": "2026-09-02"}'::jsonb, '11111111-1111-1111-1111-111111111111'),
  (uuid '0b762923-23fd-5f7b-bab2-f2391263db20', uuid '558d5051-7704-5086-b69b-c51709774e7b', '{"verdict": "caution", "score": 0, "summary": "H3 割脚骑线：门面贴人行道（0-8m 估）无退线，Masaka Rd 走廊带状商铺常态；车流人流旺。", "flags": [{"t": "c", "x": "H3 割脚骑线"}], "rules": [["H1 路冲", "PASS — Masaka Rd 直通无 T 头正对"], ["H2 反弓", "PASS — 该段近直"], ["H3 割脚", "⚠ 骑线 — 门面即人行道 0-8m，阈值 <5m，待实地量"], ["H4 剪刀", "PASS — Rubis 路口夹角 ≥70° 非正对"], ["S1 明堂", "0 — 街铺无开阔地"], ["S2 玉带", "0"], ["S3 靠山", "0"], ["S4 朝向", "0 — 门侧待实地确认（朝北则 +1）"]], "note": "走廊带状格局全段如此（SP-05 锚点同款）；实地量退线+确认门朝向", "evidence": "Esri sat z18 458m + z19 229m · 房源级（链接真钉）", "date": "2026-09-02"}'::jsonb, '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into public.survey_result (id, site_id, rent, space, contact, raw, source, created_by) values
  (uuid 'dd39ec82-ce96-5958-8879-5f742e3acc7f', uuid '5d255ce7-e779-5a96-8468-2c0593468375', null, null, null, '{"date": "2026-09-01", "point": "Hernely business park"}', 'migration', '11111111-1111-1111-1111-111111111111'),
  (uuid '538325a2-a7ba-55ae-a798-49cd3fece329', uuid '2f3718b5-e121-5a8f-af08-0cd1bb49e6b7', null, null, null, '{"date": "2026-09-01", "point": "Former hisence showroom Plot 7 AK"}', 'migration', '11111111-1111-1111-1111-111111111111'),
  (uuid '03a36bfb-23a5-59e2-b47c-a5eb5c62cfa2', uuid '2f3718b5-e121-5a8f-af08-0cd1bb49e6b7', null, null, null, '{"date": "2026-09-01", "point": "Former hisence showroom Plot 7 AK"}', 'migration', '11111111-1111-1111-1111-111111111111'),
  (uuid 'a41fc59d-1ded-54ee-8294-25b944f1831b', uuid '97a85e3e-e7e3-5687-be5c-6090e5572ca9', null, null, null, '{"date": "2026-09-01", "point": "Affayo building"}', 'migration', '11111111-1111-1111-1111-111111111111'),
  (uuid '760b90a4-2b4b-506c-ae2a-611843f79e0f', uuid '5d255ce7-e779-5a96-8468-2c0593468375', null, null, null, '{"date": "2026-09-14", "point": "Hernely business park"}', 'migration', '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

commit;