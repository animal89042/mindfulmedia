import React, { useState, useEffect } from 'react';
import { Drawer, Button, ScrollArea, Text, Group } from '@mantine/core';
import apiRoutes from './apiRoutes';
import axios from 'axios';

const AdminSidebar = () => {
    const [users, setUsers] = useState([]);
    const [opened, setOpened] = useState(true);

    useEffect(() => {
        axios
            .get(apiRoutes.getAdminUsers, { withCredentials: true })
            .then(res => {
                console.log('👥 /api/admin/users →', res.data);
                setUsers(res.data);
            })
            .catch(err => console.error('❗ fetch admin users:', err));
    }, []);

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpened(true)}
                style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}
            >
                Admin
            </Button>

            <Drawer
                opened={opened}
                onClose={() => setOpened(false)}
                zIndex={2000}
                withinPortal
                title="Users"
                padding="md"
                size="md"
                position="right"
            >
                <ScrollArea style={{ height: 'calc(100vh - 80px)' }}>
                    {users.length > 0 ? (
                        users.map(u => (
                            <Group key={u.id} position="apart" style={{ padding: '8px 0' }}>
                                <Text weight={500}>{u.name}</Text>
                                <Text size="sm" color="dimmed">
                                    {u.role}
                                </Text>
                            </Group>
                        ))
                    ) : (
                        <Text>No users found.</Text>
                    )}
                </ScrollArea>
            </Drawer>
        </>
    );
};

export default AdminSidebar;
