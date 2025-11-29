-- 添加接收人IP字段
ALTER TABLE transfer_records ADD COLUMN to_ip_address VARCHAR(45);

-- 更新示例数据的接收人IP
UPDATE transfer_records SET to_ip_address = '192.168.1.105' WHERE order_no = 'TRF20241129001';
UPDATE transfer_records SET to_ip_address = '192.168.1.100' WHERE order_no = 'TRF20241129002';
UPDATE transfer_records SET to_ip_address = '192.168.1.108' WHERE order_no = 'TRF20241129003';
UPDATE transfer_records SET to_ip_address = '192.168.1.101' WHERE order_no = 'TRF20241128001';
UPDATE transfer_records SET to_ip_address = '192.168.1.105' WHERE order_no = 'TRF20241128002';
